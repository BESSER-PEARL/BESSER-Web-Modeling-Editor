export * from "./typings"
export * from "./apollon-editor"
export * from "./utils/helpers"
export * from "./utils/versionConverter"
export * from "./utils"
export { log, setLogLevel, setLogger } from "./logger"
export type { LogLevel } from "./logger"
// SA-4: re-export the user-modelling reference metamodel as a JSON
// import so the webapp can `import { userMetaModel } from '@besser/wme'`.
// Backend remains the OCL validation authority — this is shipped purely
// for the frontend's reference / tooling.
import userMetaModelJson from "./services/userMetaModel/usermetamodel.json"
export const userMetaModel = userMetaModelJson
