import { Composition } from "remotion";
import { MedAgentWorkflow } from "./MedAgentWorkflow";

export const RemotionRoot = () => {
  return (
    <Composition
      id="MedAgentWorkflow"
      component={MedAgentWorkflow}
      durationInFrames={540}
      fps={30}
      width={1920}
      height={1080}
      defaultProps={{
        title: "MedAgent emergency access",
      }}
    />
  );
};
