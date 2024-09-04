#/usr/bin/env zsh +x
curl https://api.openai.com/v1/models \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  -H "OpenAI-Organization: $OPENAI_ORGANIZATION_ID" \
  -H "OpenAI-Project: $OPENAI_PROJECT_ID"

MESSAGE="The future is bright"

cat >.content <<EOF
{
  "model": "gpt-4o-mini",
  "messages": [{"role": "user", "content": "Create a good looking picture by taking ideas of the following message \`${MESSAGE}\`. Summarize and simplify the text such that it would become a good prompt for image generation. Generate a good looking dark fantasy image. Please return only the prompt text for the image generation. Please describe any well-known characters with your own words for dall-e-3 to use and make sure it doesn't get rejected by the dall-e-safety system."}],
  "temperature": 0.7
}
EOF

curl -s https://api.openai.com/v1/chat/completions \
  -H "OpenAI-Organization: $OPENAI_ORGANIZATION_ID" \
  -H "OpenAI-Project: $OPENAI_PROJECT_ID" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  -d @.content | jq -r '.choices[].message.content' | xargs | tee .prompt
echo "prompt => $(cat .prompt)"

cat >.content <<EOF
{
  "model": "dall-e-3",
  "prompt": "Generate an image with the following description: \`$(cat .prompt)\` and make sure it looks like the scene set in the future.",
  "response_format": "url",
  "size": "1024x1024",
  "quality": "standard",
  "n": 1
}
EOF
echo "content =>"
cat .content

URL="$(curl -s https://api.openai.com/v1/images/generations \
  -H "OpenAI-Organization: $OPENAI_ORGANIZATION_ID" \
  -H "OpenAI-Project: $OPENAI_PROJECT_ID" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  -d @.content | jq)"
echo $URL
