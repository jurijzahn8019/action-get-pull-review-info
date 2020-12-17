# action-get-pull-review-info

Action to retrieve review data for a pull request heavily inspired by:
<https://github.com/jrylan/github-action-reviews-counter>

The differences are:

- Allows pass inputs instead of using event data
- Ouputs more outputs
- Allows definition of Allowed Author Associations to calculate the counts

## Inputs

### `token`

**Required** Github PAT with organization scope, e.g. secrets.GH_TOKEN

### `owner`

The organization/user owns the repository, default from event data

### `number`

Pull request number to look for, default from event data

### `repo`

the repo name (reponame in the owner scope without owner path)
where the pull request is located, default from event data

### `collaborators`

This can be one or multiple of: 'COLLABORATOR', 'CONTRIBUTOR', 'FIRST_TIME_CONTRIBUTOR', 'FIRST_TIMER', 'MEMBER', 'OWNER', 'NONE'

Multiple values are to be separated by `,` (comma). For example: `COLLABORATOR,CONTRIBUTOR`, Defaults to All possible

This can be used to perform extra calculations only for given collaborator associations

## Outputs

### `requested`

Count of the Reamining Review Requestes of the Pull Reqeuest.
This will be 0 when all requested Peoples (Teams) have given their
Reviews

### `reviews`

Count of the given reviews in all states.

### `approved`

Overal Count of the Reviews with Approvals

### `changes_requested`

Overal Count of the Reviews wich Requests changes

### `commented`

Overal Count of the Reviews with only comments

### `dismissed`

Overal Count of the Dismissed Reviews

### `pending`

Overal Count of the Pending Reviews

### `<state>_<association>`

These outputs will contain calculated amount of reviews by Status and Author Association

for example: `approved_collaborator` or `changes_requested_first_time_contributor`

Usefull for more detailed info

### `<state>_collaborators`

This will contain amount of reviews by state for `Allowed Collaborators`
which is defined by `collaborators` input. If no collaborators specified will equal to the overal counts. For Example: `approved_collaborators`, or `commented_collaborators`

## Example usage

```yaml
name: User was Assigned to Issue
on:
  issues: [opened, reopened]

jobs:
  do-something:
    steps:
      # Pass Inputs directly
      - uses: jurijzahn8019/action-get-pull-review-info@v0.0.1
        id: checker
        with:
          token: ${{ secrets.GH_TOKEN }}
          owner: ${{ github.repository_owner }}
          repo: ${{ github.event.repository.name }}
          number: ${{ github.event.issue.number }}

      # Use Event Data
      - uses: jurijzahn8019/action-get-pull-review-info@v0.0.1
        id: checker
        with:
          token: ${{ secrets.GH_TOKEN }}

      - name: Do Something if all reviews were given
        if: ${{ steps.checker.outputs.requested < 1 }}
        run: |
          do something with the pull request
```

## Test run

```bash
DEBUG_DEPTH=8 DEBUG=action-get-pull-review-info* \
  INPUT_TOKEN=$GITHUB_TOKEN \
  INPUT_OWNER="my-org" \
  INPUT_REPO="my-repo"
  INPUT_NUMBER=666 \
  ts-node src/index.ts

DEBUG_DEPTH=8 DEBUG=action-get-pull-review-info* \
  INPUT_TOKEN=$GITHUB_TOKEN \
  GITHUB_EVENT_PATH=fixtures/review.submitted.event.json \
  ts-node src/index.ts
```
