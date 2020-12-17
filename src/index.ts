/* eslint-disable camelcase */

import { getInput, setFailed, setOutput, info } from "@actions/core";
import { getOctokit } from "@actions/github";
import { promises as fs } from "fs";
import debug from "debug";

const dbg = debug("action-get-pull-review-info:index:debug");
const trace = debug("action-get-pull-review-info:index:trace");

export enum ReviewState {
  APPROVED = "APPROVED",
  CHANGES_REQUESTED = "CHANGES_REQUESTED",
  COMMENTED = "COMMENTED",
  DISMISSED = "DISMISSED",
  PENDING = "PENDING",
}

export enum CommentAuthorAssociation {
  COLLABORATOR = "COLLABORATOR",
  CONTRIBUTOR = "CONTRIBUTOR",
  FIRST_TIME_CONTRIBUTOR = "FIRST_TIME_CONTRIBUTOR",
  FIRST_TIMER = "FIRST_TIMER",
  MEMBER = "MEMBER",
  OWNER = "OWNER",
  NONE = "NONE",
}

interface GqlReview {
  author: {
    name: string;
  };
  updatedAt: string;
  authorAssociation: CommentAuthorAssociation;
  state: ReviewState;
}

type Review = Omit<GqlReview, "updatedAt"> & Record<"updatedAt", number>;

interface GqlResult {
  repository: {
    pullRequest: {
      reviewRequests?: {
        nodes: {
          requestedReviewer: { name: string };
        }[];
      };
      reviews: {
        nodes: GqlReview[];
      };
    };
  };
}

export async function run(): Promise<void> {
  dbg("Retrieve pull request info");
  const { GITHUB_EVENT_PATH } = process.env;
  let event:
    | undefined
    | {
        pull_request: {
          number: number;
        };
        repository: {
          name: string;
          owner: {
            login: string;
          };
        };
      };
  try {
    event = JSON.parse(await fs.readFile(GITHUB_EVENT_PATH as string, "utf8"));
  } catch {
    event = undefined;
  }

  try {
    dbg("Retrieve inputs");
    const token = getInput("token", { required: true });
    const owner =
      getInput("owner", { required: false }) || event?.repository.owner.login;
    const number_input = getInput("number", { required: false });
    const repo =
      getInput("repo", { required: false }) || event?.repository.name;
    const number = number_input
      ? Number.parseInt(number_input, 10)
      : event?.pull_request.number;
    const collaborators_input = getInput("collaborators");
    const collaborators_array = collaborators_input
      ? collaborators_input.split(",").map((i) => i.trim())
      : [];
    const collaborators =
      collaborators_array.length > 0
        ? Object.values(CommentAuthorAssociation).filter((a) =>
            collaborators_input.includes(a)
          )
        : Object.values(CommentAuthorAssociation);

    dbg("Inputs: %s, %s, %d, %s", owner, repo, number, collaborators);

    if (!owner || !repo || !number) {
      throw new Error("Failed to retrieve required parameters");
    }

    const client = getOctokit(token);

    dbg("Build query");
    const query = `
      query ($owner: String!, $repo: String!, $number: Int!) {
        repository(owner: $owner, name: $repo) {
          pullRequest(number: $number) {
            reviewRequests(first: 50) {
              nodes {
                requestedReviewer {
                  ... on User { name: login }
                  ... on Team { name }
                }
              }
            }
            reviews(first: 50) {
              nodes {
                author { name: login }
                updatedAt
                authorAssociation
                state
              }
            }
          }
        }
      }    
    `;

    dbg("Fetch data");
    const params = { query, owner, number, repo };
    trace("Params: %O", params);
    const data = await client.graphql<GqlResult>(params);
    trace("Data: %O", data);

    const requested = data.repository.pullRequest.reviewRequests?.nodes || [];
    const reviews = (data.repository.pullRequest.reviews?.nodes || []).map(
      (r) => ({
        ...r,
        updatedAt: Date.parse(r.updatedAt),
      })
    );

    const byName: Record<string, Review[]> = {};
    reviews.forEach((r) => {
      // Only perocess reviews if the author was not rerequested
      if (
        !requested.find((rq) => rq.requestedReviewer.name === r.author.name)
      ) {
        if (!byName[r.author.name]) {
          byName[r.author.name] = [];
        }
        byName[r.author.name].push(r);
      }
    });

    const lasts: Review[] = [];
    Object.entries(byName).forEach(([, revs]) => {
      lasts.push(revs.sort((a, b) => b.updatedAt - a.updatedAt)[0]);
    });
    trace("Last Reviews Per Author: %O", lasts);

    const res: Record<string, Review[]> = {};
    Object.values(ReviewState).forEach((s) => {
      res[s.toLowerCase()] = lasts.filter((l) => l.state === s);
    });

    dbg("Process Result");
    trace("Result Data: %O", res);

    info("Pull request info");
    info(`Reviews Given: ${lasts.length}`);
    setOutput("reviews", lasts.length);
    info(`Requested Remaining: ${requested.length}`);
    setOutput("requested", requested.length);

    Object.entries(res).forEach(([state, revs]) => {
      info(`${state}: ${revs.length}`);
      setOutput(state, revs.length);

      Object.values(CommentAuthorAssociation).forEach((type) => {
        const count = revs.filter((r) => r.authorAssociation === type).length;

        setOutput(`${state}_${type.toLowerCase()}`, count);
      });

      const bycols = revs.filter((r) =>
        collaborators.includes(r.authorAssociation)
      ).length;

      info(`${state} for Allowed Collaborators: ${bycols}`);
      setOutput(`${state}_collaborators`, bycols);
    });
    info("Done");
  } catch (e) {
    dbg("Failed:", e);
    setFailed(e.message);
  }
}

export default run();
