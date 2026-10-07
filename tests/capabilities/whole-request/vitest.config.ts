import { defineConfig } from 'vitest/config';
export default defineConfig({test:{include:['tests/capabilities/whole-request/transaction.test.ts'],fileParallelism:false,testTimeout:30000,hookTimeout:30000}});
