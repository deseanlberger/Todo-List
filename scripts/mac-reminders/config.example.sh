# Copy to config.sh, fill in, then: chmod 600 config.sh
#
# config.sh is gitignored. The secret must not end up in the repo.

# Your scheduler, no trailing slash.
APP_URL="https://todo-list-omega-silk-22.vercel.app"

# Must match INBOX_SECRET in the Vercel project's environment variables.
INBOX_SECRET="paste-the-same-value-you-put-in-vercel"
