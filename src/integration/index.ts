// App-shell wiring between features (sync, account services, workout points).
export { AppServices, createAppServices } from './AppServices';
export { queueWorkoutForPoints, syncThenClaim, type WorkoutPointsDeps } from './workoutPoints';
