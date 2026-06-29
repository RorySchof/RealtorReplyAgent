# test 70b model

import requests
import json

# Load system prompt
with open("prompts/system-prompt.txt", "r") as f:
    system_prompt = f.read()

# Load test email
with open("prompts/test-email.txt", "r") as f:
    user_message = f.read()

# Prepare payload for your Groq proxy
payload = {
    "messages": [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_message}
    ]
}

# Call your deployed Vercel proxy
response = requests.post(
    "https://realtor-reply-agent.vercel.app/api/groq-proxy",
    json=payload
)

data = response.json()

# Print the cleaned JSON (this is your real agent output)
print(json.dumps(data["parsed"], indent=2))
