export type GroupingAnswerGroup = {
  id: string;
  text: string;
  count: number;
  reason?: string;
  children?: GroupingAnswerGroup[];
};

export type GroupingTeam = {
  id: string;
  name: string;
  color: string;
  answered: number;
  memberCount: number;
  groups: GroupingAnswerGroup[];
};

export type GroupingConsoleData = {
  roomCode: string;
  hostName: string;
  hostTeamId: string;
  questionNumber: number;
  totalQuestions: number;
  questionText: string;
  maxMergedNameLength: number;
  maxReasonLength: number;
  teams: GroupingTeam[];
};

const groupingTeams: GroupingTeam[] = [
  {
    id: "team-a",
    name: "チームA",
    color: "#58cc02",
    answered: 6,
    memberCount: 6,
    groups: [
      { id: "team-a-curry", text: "カレー", count: 4 },
      { id: "team-a-rice", text: "ごはん", count: 1 },
      { id: "team-a-bread", text: "パン", count: 1 },
    ],
  },
  {
    id: "team-b",
    name: "チームB",
    color: "#1cb0f6",
    answered: 6,
    memberCount: 6,
    groups: [
      { id: "team-b-curry", text: "カレー", count: 4 },
      { id: "team-b-curry-rice", text: "カレーライス", count: 1 },
      { id: "team-b-miso", text: "味噌汁", count: 1 },
    ],
  },
  {
    id: "team-c",
    name: "チームC",
    color: "#ce82ff",
    answered: 6,
    memberCount: 6,
    groups: [
      { id: "team-c-rice", text: "ごはん", count: 3 },
      { id: "team-c-bread", text: "パン", count: 2 },
      { id: "team-c-udon", text: "うどん", count: 1 },
    ],
  },
  {
    id: "team-d",
    name: "チームD",
    color: "#ff9600",
    answered: 6,
    memberCount: 6,
    groups: [
      { id: "team-d-curry", text: "カレー", count: 4 },
      { id: "team-d-cereal", text: "シリアル", count: 2 },
    ],
  },
  {
    id: "team-e",
    name: "チームE",
    color: "#ff4b4b",
    answered: 5,
    memberCount: 6,
    groups: [
      { id: "team-e-toast", text: "トースト", count: 3 },
      { id: "team-e-rice", text: "ごはん", count: 2 },
    ],
  },
];

export const groupingMock: GroupingConsoleData = {
  roomCode: "4821",
  hostName: "山田",
  hostTeamId: "team-a",
  questionNumber: 3,
  totalQuestions: 8,
  questionText: "朝ごはんといえば？",
  maxMergedNameLength: 20,
  maxReasonLength: 40,
  teams: groupingTeams,
};
