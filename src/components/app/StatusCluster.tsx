import React from "react";
import UpdateChecker from "@/components/update-checker";
import NoticeChip from "@/components/footer/NoticeChip";
import TranscriptionStatus from "@/components/footer/TranscriptionStatus";
import { useNav } from "./nav";

/** Background work, notices and updates: quiet text at the header's end. */
export const StatusCluster: React.FC = () => {
  const navigate = useNav();
  return (
    <>
      <TranscriptionStatus onShowHistory={() => navigate("history")} />
      <NoticeChip />
      <UpdateChecker quiet />
    </>
  );
};
