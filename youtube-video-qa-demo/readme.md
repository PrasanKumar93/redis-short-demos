## Add following environment variables to `.env` file

```yml
REDIS_URL=redis://localhost:6379
PORT=8000

SEARCHAPI_API_KEY=
GOOGLE_API_KEY=
OPENAI_API_KEY=
OPENAI_ORGANIZATION=

YOUTUBE_VIDEOS="id1,id2"
```

## Run the following commands

```sh
# to get video info
npm run 01

# to get transcript
npm run 02

# to summarize transcript
npm run 03

# to store summary vectors
npm run 04

# to search summary
npm run 05
```
