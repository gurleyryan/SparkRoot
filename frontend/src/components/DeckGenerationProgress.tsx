import React from "react";
import DebugPanel from "./Debug";
import { motion } from "framer-motion";
import LiquidSleeve from "./LiquidSleeve";
import { LucideWand, LucideSparkles, LucideScroll, LucideLeaf, LucideGem, LucideBarChart, LucideShield, LucideSword } from "lucide-react";
import { mapStepLogs } from "@/lib/mapStepLogs";
import Image from "next/image";

const steps = [
  {
    key: "filter",
    label: "Filtering Card Pool",
    icon: <LucideWand className="text-mtg-blue" size={32} />,
    color: "blue",
    description: "Filtering your collection for color identity, legality, house rules, and salt.",
  },
  {
    key: "theme",
    label: "Detecting Theme",
    icon: <LucideScroll className="text-mtg-green" size={32} />,
    color: "green",
    description: "Analyzing your commander and pool to detect the deck's main theme.",
  },
  {
    key: "categorize",
    label: "Categorizing Cards",
    icon: <LucideSparkles className="text-rarity-rare" size={32} />,
    color: "gold",
    description: "Sorting cards by function: ramp, draw, removal, and more.",
  },
  {
    key: "lands",
    label: "Selecting Lands",
    icon: <LucideLeaf className="text-mtg-green" size={32} />,
    color: "green",
    description: "Choosing optimal lands for color fixing and consistency.",
  },
  {
    key: "curve",
    label: "Shaping Mana Curve",
    icon: <LucideBarChart className="text-mtg-blue" size={32} />,
    color: "blue",
    description: "Filling curve slots for smooth gameplay and power.",
  },
  {
    key: "rocks",
    label: "Adding Mana Rocks",
    icon: <LucideGem className="text-rarity-rare" size={32} />,
    color: "gold",
    description: "Adding mana rocks for acceleration and fixing.",
  },
  {
    key: "categories",
    label: "Filling Categories",
    icon: <LucideShield className="text-mtg-white" size={32} />,
    color: "white",
    description: "Ensuring balance: ramp, draw, removal, win conditions.",
  },
  {
    key: "final",
    label: "Finalizing Deck",
    icon: <LucideSword className="text-mtg-red" size={32} />,
    color: "red",
    description: "Trimming, optimizing, and unveiling your deck!",
  },
];

export interface DeckGenerationProgressProps {
  currentStep: number; // 0-based index
  debugMessages?: string[];
  stepDetails?: Record<string, string>;
  manaTheme?: "white" | "blue" | "black" | "red" | "green" | "multicolor" | "colorless";
}

// Usage:
// - Pass the full backend step_logs array as debugMessages
// - Update currentStep as deck generation progresses
// Example:
// <DeckGenerationProgress
//   currentStep={currentStep}
//   debugMessages={stepLogs} // full array
//   stepDetails={stepDetails}
//   manaTheme={manaTheme}
// />

const stepVariants = {
  initial: { opacity: 0, y: 40 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.6 } },
  exit: { opacity: 0, y: -40, transition: { duration: 0.4 } },
};

const DeckGenerationProgress: React.FC<DeckGenerationProgressProps> = ({
  currentStep,
  debugMessages = [],
  stepDetails = {},
  manaTheme = "multicolor",
}) => {
  // Map all logs to their major step
  const stepLogMap = mapStepLogs(debugMessages);
  const currentStepKey = steps[currentStep].key;
  // Only show logs for the current step
  const currentStepMessages = stepLogMap[currentStepKey] || [];

  return (
    <LiquidSleeve manaTheme={manaTheme} className="p-6 md:p-8 my-4 w-full mx-auto relative">
      <div className="flex flex-col gap-6">
        <div className="flex flex-row items-center gap-4 mb-2">
          <motion.div
            initial={{ scale: 0.8, opacity: 0.7 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.6 }}
            className="rounded-full bg-gradient-to-br from-rarity-rare/40 to-mtg-blue/20 p-2 shadow-lg"
          >
            <Image src="/logo.png" alt="SparkRoot Logo" className="m-auto" width={40} height={28} />
          </motion.div>
          <h2 className="text-2xl md:text-3xl font-bold text-rarity-rare font-mtg drop-shadow">Deck Generation</h2>
        </div>
        <div className="flex flex-col gap-4">
          {steps.map((step, idx) => (
            <motion.div
              key={step.key}
              variants={stepVariants}
              initial="initial"
              animate={idx <= currentStep ? "animate" : "initial"}
              exit="exit"
              className={`flex items-center gap-4 rounded-xl p-4 transition-all ${
                idx === currentStep
                  ? "bg-gradient-to-r from-mtg-blue/30 to-rarity-rare/10 shadow-lg"
                  : "bg-black/30"
              }`}
            >
              <div className={`flex-shrink-0`}>{step.icon}</div>
              <div className="flex flex-col">
                <div className={`font-bold text-lg font-mtg ${idx === currentStep ? "text-rarity-rare" : "text-mtg-white/80"}`}>
                  {step.label}
                </div>
                <div className="text-mtg-white/60 text-sm">{step.description}</div>
                {stepDetails[step.key] && (
                  <div className="mt-1 text-xs text-rarity-rare/80">{stepDetails[step.key]}</div>
                )}
              </div>
              {idx === currentStep && (
                <motion.div
                  className="ml-auto"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.5 }}
                >
                  <LucideSparkles className="animate-spin text-rarity-rare" size={24} />
                </motion.div>
              )}
            </motion.div>
          ))}
        </div>
        {/* Debug messages panel (expandable) */}
        {currentStepMessages.length > 0 && (
          <DebugPanel messages={currentStepMessages} />
        )}
      </div>
    </LiquidSleeve>
  );
};

export default DeckGenerationProgress;