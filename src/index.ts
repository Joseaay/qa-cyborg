import { Application } from "probot";
import yaml from "js-yaml";
import fs from "fs";

type StatusType = "success" | "pending" | "failure" | "error";

const qaCyborgConfFile = "qa-cyborg-conf.yml";

const {
    qa_rewiewers,
    target_url,
    messages: {
        descriptions: {
            success: successMessage,
            failure: failureMessage,
            pending: pendingMessage
        },
        context: contextMessage
    }
} = yaml.safeLoad(fs.readFileSync(qaCyborgConfFile, "utf8"));

export = (app: Application) => {
    app.log("\n🚀 [APP] -- QA Cyborg 🦾  was loaded succesfully!\n");

    app.on(["pull_request.opened", "pull_request.reopened"], async context => {
        app.log(
            `\n📩  [EVENT] -- PR '${context.payload.pull_request.html_url}' has been opened.\n`
        );
        app.log(`\n🛠  [ACTION] -- Setting PR check status as pending.\n`);
        context.github.repos.createStatus(
            context.repo({
                sha: context.payload.pull_request.head.sha,
                state: "pending",
                target_url,
                description: pendingMessage,
                context: contextMessage
            })
        );
    });

    app.on("pull_request_review", async context => {
        app.log(
            `\n📩  [EVENT] -- PR '${context.payload.pull_request.html_url}' has had a review.\n`
        );
        app.log(`\n🛠  [ACTION] -- Checking review state...\n`);

        const isReviewerQa = qa_rewiewers.includes(
            context.payload.review.user.login
        );
        !!isReviewerQa
            ? app.log(`\n✅ [ACTION] -- Review user is a QA user!\n`)
            : app.log(`\n⛔️  [ACTION] -- Review user is not a QA user!\n`);

        if (!!isReviewerQa) {
            const reviewState = context.payload.review.state;
            const isReviewStateApproved = reviewState === "approved";
            !!isReviewStateApproved
                ? app.log(`\n✅ [ACTION] -- Review state is an APPROVAL!\n`)
                : app.log(
                      `\n⛔️  [ACTION] -- Review state is not an APPROVAL!\n`
                  );
            app.log(
                `\n🛠  [ACTION] -- Checking if review user is a QA reviewer...\n`
            );

            const state: StatusType =
                (isReviewerQa &&
                    (isReviewStateApproved ? "success" : "failure")) ||
                "pending";

            ({
                success: () =>
                    app.log(
                        `\n✅ [ACTION] -- Setting PR check status as success.\n`
                    ),
                failure: () =>
                    app.log(
                        `\n❌  [ACTION] -- Setting PR check status as failure.\n`
                    ),
                pending: () =>
                    app.log(
                        `\n⚠️  [ACTION] -- Setting PR check status as pending.\n`
                    )
            }[state]());

            context.github.repos.createStatus(
                context.repo({
                    sha: context.payload.pull_request.head.sha,
                    state,
                    target_url,
                    description: {
                        success: successMessage,
                        pending: pendingMessage,
                        failure: failureMessage
                    }[state],
                    context: contextMessage
                })
            );
            const issueComment = context.issue({
                body: `🦾  **${contextMessage}** - Our wonderful QA team has approved this PR! 🍻`
            });
            await context.github.issues.createComment(issueComment);
        }
    });
};
