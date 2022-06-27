import type { ExecutionContext, ImplementationFn } from 'ava';

import { EntryFile } from './entryfile';

// -- Config for assertion retrying
const MAX_RETRIES = 50;
const RETRY_INTERVAL = 100;

// UTILITY
// -------

/** Convenience function to create and write an entry file */
async function createEntryFile({
  directory,
  withDependency = false,
  withSyntaxError = false,
}: {
  directory: string;
  withDependency?: boolean;
  withSyntaxError?: boolean;
}) {
  const entryFile = new EntryFile({ directory });

  if (withDependency) {
    entryFile.addDependency();
  }

  if (withSyntaxError) {
    entryFile.addSyntaxError();
  }

  await entryFile.write();
  return entryFile;
}

/** Retries the assertion every x ms for a maximum amount of times */
async function retryAssertion(
  t: ExecutionContext,
  assertion: ImplementationFn<any, any>,
): Promise<void> {
  return new Promise((resolve, reject) => {
    let tried = 0;

    function planNextCheck() {
      setTimeout(async () => {
        tried += 1;

        const maxRetriesReached = tried >= MAX_RETRIES;
        const attempt = await t.try(assertion);

        if (attempt.passed) {
          attempt.commit();
          return resolve();
        }

        if (maxRetriesReached) {
          attempt.commit();
          return reject();
        }

        attempt.discard();
        planNextCheck();
      }, RETRY_INTERVAL);
    }

    planNextCheck();
  });
}

async function wait(ms = 500) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export { createEntryFile, retryAssertion, wait };
