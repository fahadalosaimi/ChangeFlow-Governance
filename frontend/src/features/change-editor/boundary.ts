import {ApiError} from '../../services/api/errors.ts'
// Deployment default. No environment, storage, URL or caller flag enables this.
// Only the owned synthetic test build replaces this module, outside production.
export const controlledWritesAvailable=false
export async function assertControlledWrite():Promise<void>{throw new ApiError('configuration')}
