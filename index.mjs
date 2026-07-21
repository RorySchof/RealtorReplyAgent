import { streamText } from 'ai'

async function main() {
  const result = await streamText({
    model: "openai/gpt-4o-mini",
    prompt: "Write a 2 sentence realtor email."
  })

  for await (const chunk of result.textStream) {
    process.stdout.write(chunk)
  }
}

main()
