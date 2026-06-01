/** Per-source answer block returned from /api/search/query */
export interface SourceAnswerBlock {
  filename: string;
  content: string;
}

export interface SearchQueryResults {
  cacheVersion?: string;
  answer: string;
  generalAnswer: string;
  /** When true, chat should not show a separate long general-knowledge bubble (file/API cards only). */
  omitGeneral?: boolean;
  documentAnswers?: SourceAnswerBlock[];
  imageAnswers?: SourceAnswerBlock[];
  responseStyle?: string;
  apiResults?: { source: string; data: unknown }[];
  pdfResults?: string[];
  imageResults?: string[];
}
