import { AsyncLocalStorage } from 'async_hooks';

export const RequestContext = new AsyncLocalStorage<any>();
