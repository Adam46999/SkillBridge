// app/manage-skills-to-teach/index.tsx
import React from "react";
import ManageSkillsToTeachScreen from "./ManageSkillsToTeachScreen";

export default function ManageSkillsToTeachRoute() {
  return <ManageSkillsToTeachScreen />;
}

export const options = {
  title: "Manage skills to teach",
  headerTitle: "Manage skills to teach",
  headerShown: false,
};
