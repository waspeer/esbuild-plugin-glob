import { customAlphabet } from 'nanoid';

import type { ExecutionContext, ImplementationFn } from 'ava';

import { EntryFile } from './entryfile';

// Config for assertion retrying
const MAX_RETRIES = 50;
const RETRY_INTERVAL = 100;

// Used to create directory and file names
const nanoid = customAlphabet('ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz', 10);

// UTILITY
// -------

/** Convenience function to create and write an entry file */
async function createEntryFile({
  directory,
  nested,
  suffix,
  withDependency = false,
  withSyntaxError = false,
}: {
  directory: string;
  nested?: string | string[];
  suffix?: string;
  withDependency?: boolean;
  withSyntaxError?: boolean;
}) {
  const entryFile = new EntryFile({
    directory,
    nested,
    name: randomString() + (suffix ? `.${suffix}` : ''),
  });

  if (withDependency) {
    entryFile.addDependency();
  }

  if (withSyntaxError) {
    entryFile.addSyntaxError();
  }

  await entryFile.write();
  return entryFile;
}

/** Creates a random string [a-zA-Z]{10} */
function randomString() {
  return nanoid();
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

/** Waits the specified amount of ms. Defaults to 500ms. */
async function wait(ms = 500) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export { createEntryFile, createPath, randomString, retryAssertion, wait };
