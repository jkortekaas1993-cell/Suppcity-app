// App-shell wiring between features (sync, account services, workout points).
export { AppServices, createAppServices } from './AppServices';
export { finalSyncThenWipe, wipeAllLocalData, type LocalSignOutResult, type SignOutDeps } from './signOutFlow';
export { queueWorkoutForPoints, syncThenClaim, type WorkoutPointsDeps } from './workoutPoints';
export { loadTrainingProfile, useTrainingProfile, type TrainingProfile } from './trainingProfile';
