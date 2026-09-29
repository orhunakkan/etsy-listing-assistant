// Makes one real Jev call to confirm the API key and connection work.
// Run from the repo root: npm run jev:check
import { APIError, choice, noul, TypeSafeClient } from '@typesafe-ai/sdk';

if (!process.env['TYPESAFE_API_KEY']?.trim()) {
  console.error('TYPESAFE_API_KEY is not set. Copy .env.example to .env at the repo root and add your key.');
  process.exit(1);
}

const client = new TypeSafeClient();

try {
  const { model, answers, usage } = await client.systemOne({
    state: 'I was charged twice for my subscription this month. Please refund one of the charges.',
    questions: {
      topic: choice('What is this message about?', { billing: null, technical: null, other: null }),
      refund: noul('Does the message ask for a refund?'),
    },
  });

  console.log(`Jev responded (model: ${model}, input tokens: ${usage.input_tokens})`);
  console.log(`  topic:  ${answers.topic.choice} (confidence ${answers.topic.confidence.toFixed(2)})`);
  console.log(`  refund: ${answers.refund.noul.toFixed(2)} probability of yes`);
} catch (error) {
  if (error instanceof APIError) {
    console.error(`Jev request failed with HTTP ${error.status}: ${error.message}`);
  } else {
    console.error('Jev request failed:', error);
  }
  process.exit(1);
}
