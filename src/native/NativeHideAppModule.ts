import { TurboModule, TurboModuleRegistry } from "react-native";

export interface Spec extends TurboModule {
  hide(): void;
  closeAndRemoveFromRecents(): void;
}

export default TurboModuleRegistry.getEnforcing<Spec>("HideAppModule");