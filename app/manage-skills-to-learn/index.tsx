// app/manage-skills-to-learn/index.tsx
import React from "react";
import ManageSkillsToLearnScreen from "./ManageSkillsToLearnScreen";

export default function ManageSkillsToLearnRoute() {
  return <ManageSkillsToLearnScreen />;
}

export const options = {
  title: "Manage skills to learn",
  headerTitle: "Skills you want to learn",
  headerShown: false,
};
