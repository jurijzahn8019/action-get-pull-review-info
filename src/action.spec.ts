/* eslint-disable @typescript-eslint/no-explicit-any */
import { getInput, info, setFailed, setOutput } from "@actions/core";
import { getOctokit } from "@actions/github";
import { run } from "./action";

jest.mock("@actions/core");
jest.mock("@actions/github");

const getInputMock = getInput as jest.MockedFunction<typeof getInput>;
const setFailedMock = setFailed as jest.MockedFunction<typeof setFailed>;
const getOctokitMock = getOctokit as jest.MockedFunction<typeof getOctokit>;
const infoMock = info as jest.MockedFunction<typeof info>;
const setOutputMock = setOutput as jest.MockedFunction<typeof setOutput>;

const octokit = {
  graphql: jest.fn(),
};

describe("action", () => {
  beforeEach(() => {
    process.env.GITHUB_EVENT_PATH = "fixtures/review.submitted.event.json";

    getOctokitMock.mockReturnValue(octokit as any);
    getInputMock.mockReturnValueOnce("THE TOKEN");
    octokit.graphql.mockResolvedValue({
      repository: {
        pullRequest: {
          mergeable: "MERGEABLE",
          mergeStateStatus: "CLEAN",
          reviewRequests: {
            nodes: [
              {
                requestedReviewer: {
                  name: "bim44666",
                },
              },
            ],
          },
          reviews: {
            nodes: [
              {
                author: {
                  name: "bim44666",
                },
                updatedAt: "2020-12-16T14:15:43Z",
                authorAssociation: "NONE",
                state: "CHANGES_REQUESTED",
              },
              {
                author: {
                  name: "foobar5344",
                },
                updatedAt: "2020-12-16T14:17:14Z",
                authorAssociation: "FIRST_TIMER",
                state: "CHANGES_REQUESTED",
              },
              {
                author: {
                  name: "bazbar634",
                },
                updatedAt: "2020-12-16T14:55:57Z",
                authorAssociation: "CONTRIBUTOR",
                state: "COMMENTED",
              },
              {
                author: {
                  name: "bazbar634",
                },
                updatedAt: "2020-12-17T07:10:16Z",
                authorAssociation: "CONTRIBUTOR",
                state: "DISMISSED",
              },
              {
                author: {
                  name: "bazbar634",
                },
                updatedAt: "2020-12-17T07:11:08Z",
                authorAssociation: "CONTRIBUTOR",
                state: "COMMENTED",
              },
              {
                author: {
                  name: "bazbar634",
                },
                updatedAt: "2020-12-17T07:51:47Z",
                authorAssociation: "CONTRIBUTOR",
                state: "CHANGES_REQUESTED",
              },
            ],
          },
        },
      },
    });
  });

  describe("run", () => {
    it("Happy Path", async () => {
      await expect(run()).resolves.toBeUndefined();

      expect(getInputMock).toHaveBeenCalledTimes(5);
      expect(getInputMock).toHaveBeenNthCalledWith(1, "token", {
        required: true,
      });
      expect(getOctokitMock).toHaveBeenCalledWith("THE TOKEN", {
        previews: ["merge-info"],
      });
      expect(octokit.graphql).toHaveBeenCalledWith({
        number: 743,
        owner: "otto-ec",
        repo: "assets_protecty",
        query: `
      query ($owner: String!, $repo: String!, $number: Int!) {
        repository(owner: $owner, name: $repo) {
          pullRequest(number: $number) {
            reviewRequests(last: 100) {
              nodes {
                requestedReviewer {
                  ... on User { name: login }
                  ... on Team { name }
                }
              }
            }
            reviews(last: 100) {
              nodes {
                author { name: login }
                updatedAt
                authorAssociation
                state
              }
            }
            mergeable
            mergeStateStatus
          }
        }
      }
    `,
      });

      expect(infoMock.mock.calls.map((c) => c.join(", "))).toMatchSnapshot(
        "Info",
      );
      expect(setOutputMock.mock.calls.map((c) => c.join(", "))).toMatchSnapshot(
        "setOutput",
      );
      expect(setFailedMock).not.toHaveBeenCalled();
    });

    it("Should fail due to missing input", async () => {
      process.env.GITHUB_EVENT_PATH = "foo/bar";

      await expect(run()).resolves.toBeUndefined();

      expect(setFailedMock).toHaveBeenCalledWith(
        "Failed to retrieve required parameters",
      );
    });

    it("Should use inputs", async () => {
      getInputMock.mockReturnValueOnce("the-owner");
      getInputMock.mockReturnValueOnce("the-repo");
      getInputMock.mockReturnValueOnce("666999");
      getInputMock.mockReturnValueOnce("FIRST_TIMER");

      await expect(run()).resolves.toBeUndefined();

      expect(octokit.graphql).toHaveBeenCalledWith({
        number: 666999,
        owner: "the-owner",
        repo: "the-repo",
        query: `
      query ($owner: String!, $repo: String!, $number: Int!) {
        repository(owner: $owner, name: $repo) {
          pullRequest(number: $number) {
            reviewRequests(last: 100) {
              nodes {
                requestedReviewer {
                  ... on User { name: login }
                  ... on Team { name }
                }
              }
            }
            reviews(last: 100) {
              nodes {
                author { name: login }
                updatedAt
                authorAssociation
                state
              }
            }
            mergeable
            mergeStateStatus
          }
        }
      }
    `,
      });

      expect(setFailedMock).not.toHaveBeenCalled();
      expect(setOutputMock.mock.calls.map((c) => c.join(", "))).toMatchSnapshot(
        "setOutput",
      );
    });

    it("Should handle no data", async () => {
      octokit.graphql.mockResolvedValue({
        repository: {
          pullRequest: {},
        },
      });

      await expect(run()).resolves.toBeUndefined();

      expect(setFailedMock).not.toHaveBeenCalled();
      expect(setOutputMock.mock.calls.map((c) => c.join(", "))).toMatchSnapshot(
        "setOutput",
      );
    });

    it("Should handle inaccessible data", async () => {
      octokit.graphql.mockResolvedValue({
        repository: {
          pullRequest: {
            mergeable: "UNKNOWN",
            mergeStateStatus: "DIRTY",
            reviewRequests: {
              nodes: [
                { requestedReviewer: null },
                { requestedReviewer: { name: "bim44666" } },
              ],
            },
            reviews: {
              nodes: [
                {
                  author: {
                    name: "bim44666",
                  },
                  updatedAt: "2020-12-16T14:15:43Z",
                  authorAssociation: "NONE",
                  state: "CHANGES_REQUESTED",
                },
                {
                  author: {
                    name: "foobar5344",
                  },
                  updatedAt: "2020-12-16T14:17:14Z",
                  authorAssociation: "FIRST_TIMER",
                  state: "CHANGES_REQUESTED",
                },
                {
                  author: {
                    name: "bazbar634",
                  },
                  updatedAt: "2020-12-16T14:55:57Z",
                  authorAssociation: "CONTRIBUTOR",
                  state: "COMMENTED",
                },
                {
                  author: {
                    name: "bazbar634",
                  },
                  updatedAt: "2020-12-17T07:10:16Z",
                  authorAssociation: "CONTRIBUTOR",
                  state: "DISMISSED",
                },
                {
                  author: {
                    name: "bazbar634",
                  },
                  updatedAt: "2020-12-17T07:11:08Z",
                  authorAssociation: "CONTRIBUTOR",
                  state: "COMMENTED",
                },
                {
                  author: {
                    name: "bazbar634",
                  },
                  updatedAt: "2020-12-17T07:51:47Z",
                  authorAssociation: "CONTRIBUTOR",
                  state: "CHANGES_REQUESTED",
                },
              ],
            },
          },
        },
      });

      await expect(run()).resolves.toBeUndefined();

      expect(setFailedMock).not.toHaveBeenCalled();
      expect(setOutputMock.mock.calls.map((c) => c.join(", "))).toMatchSnapshot(
        "setOutput",
      );
    });
  });
});
