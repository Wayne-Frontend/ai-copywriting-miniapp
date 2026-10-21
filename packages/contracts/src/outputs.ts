export interface TemplateOutputMap {
  XHS_TITLE: {
    items: [
      { title: string; angle: string },
      { title: string; angle: string },
      { title: string; angle: string },
      { title: string; angle: string },
      { title: string; angle: string },
    ];
  };
  XHS_SCRIPT: {
    title: string;
    hook: string;
    bodyParagraphs: string[];
    ending: string;
    hashtags: string[];
  };
  VIDEO_SPEECH: {
    hook: string;
    lines: string[];
    ending: string;
  };
  MOMENTS_COPY: {
    text: string;
  };
  TEXT_REWRITE: {
    rewrittenText: string;
    changeSummary: string[];
  };
  WEEKLY_REPORT: {
    title: string;
    completed: string[];
    achievements: string[];
    problemsAndImprovements: string[];
    nextWeek: string[];
  };
  MEETING_NOTES: {
    title: string;
    meetingDate: string | null;
    participants: string[];
    discussionPoints: string[];
    decisions: string[];
    actionItems: { task: string; owner: string | null; dueDate: string | null }[];
    openQuestions: string[];
  };
  WORK_EMAIL: {
    subject: string;
    greeting: string;
    bodyParagraphs: string[];
    closing: string;
    signaturePlaceholder: string;
  };
  ESSAY_OUTLINE: {
    topic: string;
    centralIdea: string;
    sections: { heading: string; points: string[] }[];
    writingTips: string[];
    materialDirections: string[];
  };
  THESIS_OUTLINE: {
    titleSuggestion: string;
    researchQuestion: string;
    researchScope: string;
    chapters: { heading: string; subsections: string[] }[];
    methodSuggestions: string[];
    itemsToVerify: string[];
  };
}
