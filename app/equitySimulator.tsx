"use client";

import { useEffect, useState } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type TeamMember = {
  name: string;
  joinMonth: number;
  exitMonth: number | null;
  color: string;
};

type SimulationResults = {
  monthlySnapshots: any[];
  memberSnapshots: Record<string, any[]>;
  monthlyShares: any[];
  cumulativeShares: any[];
  chartData: any[];
};

const FIXED_FOUNDER_RATIO = 0.1;
const DEFAULT_NEW_SHARES = 1000;

export default function EquitySimulator() {
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([
    { name: "Founder", joinMonth: 0, exitMonth: null, color: "#3498db" },
    { name: "A", joinMonth: 3, exitMonth: null, color: "#2ecc71" },
    { name: "B", joinMonth: 4, exitMonth: 16, color: "#e74c3c" },
    { name: "C", joinMonth: 12, exitMonth: null, color: "#f39c12" },
    { name: "D", joinMonth: 27, exitMonth: null, color: "#9b59b6" },
  ]);
  const [simulationMonths, setSimulationMonths] = useState(60);
  const [results, setResults] = useState<SimulationResults | null>(null);
  const [showingTab, setShowingTab] = useState("monthlyShares");
  const [showAddMember, setShowAddMember] = useState(false);
  const [newMember, setNewMember] = useState({
    name: "",
    joinMonth: 0,
    exitMonth: null as number | null,
  });

  const calculateMonthlyResults = (): SimulationResults => {
    const yearCount = Math.ceil(simulationMonths / 12);
    const months = Array.from({ length: yearCount }, (_, i) => (i + 1) * 12);

    // Initialize results structure
    const simulationResults: SimulationResults = {
      monthlySnapshots: [],
      memberSnapshots: {},
      monthlyShares: [],
      cumulativeShares: [],
      chartData: [],
    };

    // Initialize member data
    teamMembers.forEach((member) => {
      simulationResults.memberSnapshots[member.name] = [];
    });

    let totalSharesIssued = DEFAULT_NEW_SHARES;
    let previousMonthShares: Record<string, number> = {};

    teamMembers.forEach((member) => {
      previousMonthShares[member.name] =
        member.name === "Founder" ? DEFAULT_NEW_SHARES : 0;
    });

    // Show starting point (month 0)
    simulationResults.cumulativeShares.push({
      month: 0,
      totalIssued: totalSharesIssued,
      ...Object.keys(previousMonthShares).reduce(
        (acc, memberName) => {
          acc[memberName] = previousMonthShares[memberName];
          return acc;
        },
        {} as Record<string, number>
      ),
    });

    // For each year-end
    months.forEach((monthEnd) => {
      const actualMonthEnd = Math.min(monthEnd, simulationMonths);

      // Calculate cumulative contribution scores for each member
      const contributionScores: Record<string, number> = {};
      let totalContribution = 0;

      teamMembers.forEach((member) => {
        // Calculate contribution based on months worked
        const startMonth = member.joinMonth;
        const endMonth =
          member.exitMonth !== null
            ? Math.min(actualMonthEnd, member.exitMonth)
            : actualMonthEnd;

        const monthsContributed = Math.max(0, endMonth - startMonth);

        contributionScores[member.name] =
          monthsContributed >= 12 ? monthsContributed : 0;
        totalContribution += contributionScores[member.name];
      });

      // Calculate target share ratios considering founder's 10% reserved
      const targetShareRatios: Record<string, number> = {};
      const targetShares: Record<string, number> = {};
      let newSharesNeeded = 0;
      let newSharesPerMember: Record<string, number> = {};

      teamMembers.forEach((member) => {
        if (member.name === "Founder") {
          // Founder always keeps at least 10%
          // Calculate what percentage of the 90% the founder gets from contribution
          const founderContribRatio =
            totalContribution > 0
              ? (contributionScores[member.name] / totalContribution) *
                  (1 - FIXED_FOUNDER_RATIO) +
                FIXED_FOUNDER_RATIO
              : 1;

          targetShareRatios[member.name] = founderContribRatio;
        } else {
          // Others share the remaining 90% based on contribution
          targetShareRatios[member.name] =
            totalContribution > 0
              ? (contributionScores[member.name] / totalContribution) *
                (1 - FIXED_FOUNDER_RATIO)
              : 0;
        }
      });

      const tmpTotalSharesIssued = Math.max(
        Math.round(
          previousMonthShares["Founder"] / targetShareRatios["Founder"]
        ),
        totalContribution > 0
          ? totalSharesIssued + DEFAULT_NEW_SHARES
          : totalSharesIssued
      );

      // Calculate how many shares each member should have based on target ratio
      teamMembers.forEach((member) => {
        targetShares[member.name] = Math.round(
          targetShareRatios[member.name] * tmpTotalSharesIssued
        );

        // Calculate how many new shares needed (we never take shares away)
        newSharesPerMember[member.name] = Math.max(
          0,
          targetShares[member.name] - previousMonthShares[member.name]
        );

        newSharesNeeded += newSharesPerMember[member.name];
      });
      totalSharesIssued = totalSharesIssued + newSharesNeeded;

      // Update previous month shares for next iteration
      teamMembers.forEach((member) => {
        previousMonthShares[member.name] =
          previousMonthShares[member.name] + newSharesPerMember[member.name];
      });

      // Store monthly snapshot
      simulationResults.monthlySnapshots.push({
        year:
          Math.floor(actualMonthEnd / 12) + (actualMonthEnd % 12 > 0 ? 1 : 0),
        month: actualMonthEnd,
        contributionScores: { ...contributionScores },
        targetShareRatios: { ...targetShareRatios },
        newSharesPerMember: { ...newSharesPerMember },
        cumulativeShares: { ...previousMonthShares },
        totalContribution,
        newSharesIssued: newSharesNeeded,
        totalSharesIssued,
      });

      // Store member snapshots
      teamMembers.forEach((member) => {
        simulationResults.memberSnapshots[member.name].push({
          year:
            Math.floor(actualMonthEnd / 12) + (actualMonthEnd % 12 > 0 ? 1 : 0),
          month: actualMonthEnd,
          contributionScore: contributionScores[member.name],
          contributionRatio: targetShareRatios[member.name],
          newShares: newSharesPerMember[member.name],
          cumulativeShares: previousMonthShares[member.name],
          ownershipPercentage:
            (previousMonthShares[member.name] / totalSharesIssued) * 100,
        });
      });

      // Format monthly shares data for table
      simulationResults.monthlyShares.push({
        month: actualMonthEnd,
        year:
          Math.floor(actualMonthEnd / 12) + (actualMonthEnd % 12 > 0 ? 1 : 0),
        totalIssued: newSharesNeeded,
        ...Object.keys(newSharesPerMember).reduce(
          (acc, memberName) => {
            acc[memberName] = newSharesPerMember[memberName];

            return acc;
          },
          {} as Record<string, number>
        ),
      });

      // Format cumulative shares data for table
      simulationResults.cumulativeShares.push({
        month: actualMonthEnd,
        year:
          Math.floor(actualMonthEnd / 12) + (actualMonthEnd % 12 > 0 ? 1 : 0),
        totalIssued: totalSharesIssued,
        ...Object.keys(previousMonthShares).reduce(
          (acc, memberName) => {
            acc[memberName] = previousMonthShares[memberName];
            return acc;
          },
          {} as Record<string, number>
        ),
      });
    });

    // Prepare chart data for ownership percentage over time
    const chartData = simulationResults.cumulativeShares.map((snapshot) => {
      const chartPoint: Record<string, any> = {
        month: snapshot.month,
        year: snapshot.year,
      };

      teamMembers.forEach((member) => {
        const memberShares = parseFloat(snapshot[member.name] || "0");
        const totalShares = parseFloat(snapshot.totalIssued);

        chartPoint[member.name] =
          totalShares > 0 ? (memberShares / totalShares) * 100 : 0;
      });

      return chartPoint;
    });

    simulationResults.chartData = chartData;

    return simulationResults;
  };

  const handleAddMember = () => {
    if (newMember.name.trim() === "") {
      alert("구성원 이름을 입력해주세요.");

      return;
    }

    // 랜덤 색상 생성
    const randomColor = "#" + Math.floor(Math.random() * 16777215).toString(16);

    setTeamMembers([
      ...teamMembers,
      {
        name: newMember.name,
        joinMonth: parseInt(newMember.joinMonth.toString()),
        exitMonth:
          newMember.exitMonth !== null
            ? parseInt(newMember.exitMonth.toString())
            : null,
        color: randomColor,
      },
    ]);

    setNewMember({ name: "", joinMonth: 0, exitMonth: null });
    setShowAddMember(false);
  };

  const handleRemoveMember = (index: number) => {
    if (index === 0) {
      alert("창업자는 삭제할 수 없습니다.");

      return;
    }

    const newTeamMembers = [...teamMembers];

    newTeamMembers.splice(index, 1);
    setTeamMembers(newTeamMembers);
  };

  const handleUpdateMember = (
    index: number,
    field: string,
    value: string | number | null
  ) => {
    const newTeamMembers = [...teamMembers];

    newTeamMembers[index] = {
      ...newTeamMembers[index],
      [field]:
        field.includes("Month") && value !== null
          ? parseInt(value.toString())
          : value,
    };
    setTeamMembers(newTeamMembers);
  };

  const runSimulation = () => {
    const results = calculateMonthlyResults();

    setResults(results);
  };

  useEffect(() => {
    runSimulation();
  }, []);

  const monthToYearMonth = (months: number) => {
    const years = Math.floor(months / 12);
    const remainingMonths = months % 12;

    if (remainingMonths === 0) {
      return `${years}년`;
    } else {
      return `${years}년 ${remainingMonths}개월`;
    }
  };

  return (
    <div className="flex flex-col p-3 sm:p-6 max-w-6xl mx-auto bg-gray-50 min-h-screen">
      <h1 className="text-2xl sm:text-3xl font-bold text-center mb-4 sm:mb-6 text-blue-800">
        주식 분배 시뮬레이터
      </h1>

      <div className="flex flex-col md:flex-row gap-4 sm:gap-6">
        <div className="md:w-64 bg-white p-3 sm:p-4 rounded-lg shadow-md self-start">
          <h2 className="text-lg font-semibold mb-2 sm:mb-3 text-blue-800 pb-2 flex justify-between items-center">
            <span>정책 사항</span>
          </h2>

          <div className="overflow-x-auto">
            <table className="w-full text-xs sm:text-sm mb-3 border-collapse">
              <thead>
                <tr className="bg-gray-50">
                  <th className="py-1 px-2 text-left border">요소</th>
                  <th className="py-1 px-2 text-left border">구조</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="py-1 px-2 border">지분 구조</td>
                  <td className="py-1 px-2 border">
                    창업자 1,000주 보유로 시작, 이후 매년 신주 발행으로 희석
                  </td>
                </tr>
                <tr>
                  <td className="py-1 px-2 border">대표 고정 지분</td>
                  <td className="py-1 px-2 border">
                    전체 지분의 <strong>10% 고정</strong> (대표 교체되어도 유지)
                  </td>
                </tr>
                <tr>
                  <td className="py-1 px-2 border">팀원 지분</td>
                  <td className="py-1 px-2 border">
                    1년 이상 근무자에 한해 <strong>근무 개월 수 비례</strong>로
                    분배
                  </td>
                </tr>
                <tr>
                  <td className="py-1 px-2 border">기여 측정</td>
                  <td className="py-1 px-2 border">
                    개인 성과 아닌 <strong>근무 기간 (월 단위)</strong>
                  </td>
                </tr>
                <tr>
                  <td className="py-1 px-2 border">신주 발행</td>
                  <td className="py-1 px-2 border">
                    연말마다 지분 불균형을 보정하기 위해{" "}
                    <strong>최소 1,000주 이상</strong> 신주 발행
                  </td>
                </tr>
                <tr>
                  <td className="py-1 px-2 border">퇴사자</td>
                  <td className="py-1 px-2 border">
                    퇴사 시점까지의 지분은 유지, 이후 신주 발행 대상에서 제외
                  </td>
                </tr>
                <tr>
                  <td className="py-1 px-2 border">의사결정</td>
                  <td className="py-1 px-2 border">
                    <strong>과반 지분 합의</strong>로만 전략적 결정 가능 (대표
                    포함)
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex-1">
          <div className="bg-white p-3 sm:p-6 rounded-lg shadow-md mb-4 sm:mb-6">
            <h2 className="text-lg sm:text-xl font-semibold mb-3 sm:mb-4">
              팀 구성 및 설정
            </h2>

            <div className="mb-4">
              <label
                htmlFor="simulation-months"
                className="block text-sm font-medium mb-1"
              >
                시뮬레이션 기간 (개월)
              </label>
              <div className="flex items-center gap-2 sm:gap-4">
                <input
                  id="simulation-months"
                  type="range"
                  min="12"
                  max="120"
                  step="12"
                  value={simulationMonths}
                  onChange={(e) =>
                    setSimulationMonths(parseInt(e.target.value))
                  }
                  className="w-full"
                />
                <span className="text-xs sm:text-sm font-medium whitespace-nowrap">
                  {simulationMonths}개월 ({Math.floor(simulationMonths / 12)}년)
                </span>
              </div>
            </div>

            <div className="mb-4">
              <div className="flex justify-between items-center mb-2">
                <h3 className="text-sm sm:text-md font-medium">팀 구성원</h3>
                <button
                  onClick={() => setShowAddMember(!showAddMember)}
                  className="text-xs sm:text-sm bg-blue-500 hover:bg-blue-600 text-white px-2 sm:px-3 py-1 rounded"
                >
                  {showAddMember ? "취소" : "구성원 추가"}
                </button>
              </div>

              {showAddMember && (
                <div className="flex flex-wrap gap-2 sm:gap-4 mb-4 p-2 sm:p-3 bg-blue-50 rounded">
                  <input
                    type="text"
                    placeholder="이름"
                    value={newMember.name}
                    onChange={(e) =>
                      setNewMember({ ...newMember, name: e.target.value })
                    }
                    className="flex-1 min-w-[100px] sm:min-w-[120px] p-1 sm:p-2 border rounded text-sm"
                  />
                  <div className="flex-1 min-w-[100px] sm:min-w-[120px]">
                    <input
                      type="number"
                      placeholder="합류 월차"
                      value={newMember.joinMonth}
                      onChange={(e) =>
                        setNewMember({
                          ...newMember,
                          joinMonth: parseInt(e.target.value),
                        })
                      }
                      className="w-full p-1 sm:p-2 border rounded text-sm"
                      min="0"
                    />
                  </div>
                  <div className="flex-1 min-w-[100px] sm:min-w-[120px]">
                    <input
                      type="number"
                      placeholder="퇴사 월차 (선택)"
                      value={newMember.exitMonth ?? ""}
                      onChange={(e) => {
                        const value =
                          e.target.value.trim() === ""
                            ? null
                            : parseInt(e.target.value);
                        setNewMember({ ...newMember, exitMonth: value });
                      }}
                      className="w-full p-1 sm:p-2 border rounded text-sm"
                      min={newMember.joinMonth || 0}
                    />
                  </div>
                  <button
                    onClick={handleAddMember}
                    className="bg-green-500 hover:bg-green-600 text-white px-2 sm:px-4 py-1 rounded text-sm"
                  >
                    추가
                  </button>
                </div>
              )}

              <div className="bg-gray-100 rounded overflow-hidden">
                <table className="w-full text-xs sm:text-sm">
                  <thead>
                    <tr className="bg-gray-200">
                      <th className="py-1 sm:py-2 px-1 sm:px-3 text-left">
                        이름
                      </th>
                      <th className="py-1 sm:py-2 px-1 sm:px-3 text-left">
                        합류 시점
                      </th>
                      <th className="py-1 sm:py-2 px-1 sm:px-3 text-left">
                        퇴사 시점
                      </th>
                      <th className="py-1 sm:py-2 px-1 sm:px-3 text-center w-10 sm:w-16">
                        액션
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {teamMembers.map((member, index) => (
                      <tr key={index} className="border-t border-gray-200">
                        <td className="py-1 sm:py-2 px-1 sm:px-3">
                          <div className="flex items-center gap-1 sm:gap-2">
                            <div
                              className="w-2 sm:w-3 h-2 sm:h-3 rounded-full"
                              style={{ backgroundColor: member.color }}
                            ></div>
                            <input
                              type="text"
                              value={member.name}
                              onChange={(e) =>
                                handleUpdateMember(
                                  index,
                                  "name",
                                  e.target.value
                                )
                              }
                              className="border-b border-gray-300 bg-transparent w-full text-xs sm:text-sm"
                              disabled={index === 0}
                            />
                          </div>
                        </td>
                        <td className="py-1 sm:py-2 px-1 sm:px-3">
                          <div className="flex items-center gap-1 sm:gap-2">
                            <input
                              type="number"
                              value={member.joinMonth}
                              onChange={(e) =>
                                handleUpdateMember(
                                  index,
                                  "joinMonth",
                                  e.target.value
                                )
                              }
                              className="border-b border-gray-300 bg-transparent w-12 sm:w-16 mr-1 sm:mr-2 text-xs sm:text-sm"
                              min="0"
                              disabled={index === 0}
                            />
                            <span className="text-xs text-gray-500 hidden sm:inline">
                              ({monthToYearMonth(member.joinMonth)})
                            </span>
                          </div>
                        </td>
                        <td className="py-1 sm:py-2 px-1 sm:px-3">
                          <div className="flex items-center gap-1 sm:gap-2">
                            <input
                              type="number"
                              value={member.exitMonth ?? ""}
                              onChange={(e) => {
                                const value =
                                  e.target.value.trim() === ""
                                    ? null
                                    : e.target.value;
                                handleUpdateMember(index, "exitMonth", value);
                              }}
                              className="border-b border-gray-300 bg-transparent w-12 sm:w-16 mr-1 sm:mr-2 text-xs sm:text-sm"
                              min={member.joinMonth}
                              placeholder="없음"
                            />
                            {member.exitMonth !== null && (
                              <span className="text-xs text-gray-500 hidden sm:inline">
                                근무: (
                                {monthToYearMonth(
                                  member.exitMonth - member.joinMonth
                                )}
                                )
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-1 sm:py-2 px-1 sm:px-3 text-center">
                          <button
                            onClick={() => handleRemoveMember(index)}
                            className="text-red-500 hover:text-red-700 text-xs sm:text-sm"
                            disabled={index === 0}
                          >
                            {index !== 0 ? "삭제" : ""}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <button
              onClick={runSimulation}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white py-1 sm:py-2 rounded-md font-medium text-sm"
            >
              시뮬레이션 실행
            </button>
          </div>

          {results && (
            <div className="bg-white p-3 sm:p-6 rounded-lg shadow-md mb-4 sm:mb-6">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-2">
                <h2 className="text-lg sm:text-xl font-semibold">
                  시뮬레이션 결과
                </h2>
                <div className="flex flex-wrap gap-1 sm:gap-2">
                  <button
                    onClick={() => setShowingTab("monthlyShares")}
                    className={`px-2 sm:px-3 py-1 rounded text-xs sm:text-sm ${
                      showingTab === "monthlyShares"
                        ? "bg-blue-500 text-white"
                        : "bg-gray-200"
                    }`}
                  >
                    연간 발행량
                  </button>
                  <button
                    onClick={() => setShowingTab("cumulativeShares")}
                    className={`px-2 sm:px-3 py-1 rounded text-xs sm:text-sm ${
                      showingTab === "cumulativeShares"
                        ? "bg-blue-500 text-white"
                        : "bg-gray-200"
                    }`}
                  >
                    누적 주식
                  </button>
                  <button
                    onClick={() => setShowingTab("ownershipChart")}
                    className={`px-2 sm:px-3 py-1 rounded text-xs sm:text-sm ${
                      showingTab === "ownershipChart"
                        ? "bg-blue-500 text-white"
                        : "bg-gray-200"
                    }`}
                  >
                    지분율 차트
                  </button>
                  <button
                    onClick={() => setShowingTab("detailData")}
                    className={`px-2 sm:px-3 py-1 rounded text-xs sm:text-sm ${
                      showingTab === "detailData"
                        ? "bg-blue-500 text-white"
                        : "bg-gray-200"
                    }`}
                  >
                    상세 데이터
                  </button>
                </div>
              </div>

              {showingTab === "monthlyShares" && (
                <div className="overflow-x-auto">
                  <h3 className="text-base sm:text-lg font-medium mb-2">
                    연간 신주 발행량
                  </h3>
                  <table className="w-full text-xs sm:text-sm">
                    <thead>
                      <tr className="bg-gray-100">
                        <th className="py-1 sm:py-2 px-1 sm:px-3 text-left">
                          연차
                        </th>
                        {teamMembers.map((member, idx) => (
                          <th
                            key={idx}
                            className="py-1 sm:py-2 px-1 sm:px-3 text-right"
                          >
                            <div className="flex items-center justify-end gap-1 sm:gap-2">
                              <div
                                className="w-2 sm:w-3 h-2 sm:h-3 rounded-full"
                                style={{ backgroundColor: member.color }}
                              ></div>
                              <span className="whitespace-nowrap">
                                {member.name}
                              </span>
                            </div>
                          </th>
                        ))}
                        <th className="py-1 sm:py-2 px-1 sm:px-3 text-right font-bold">
                          총 발행량
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {results.monthlyShares.map((row, idx) => (
                        <tr key={idx} className="border-t border-gray-200">
                          <td className="py-1 sm:py-2 px-1 sm:px-3">
                            {monthToYearMonth(row.month)}
                          </td>
                          {teamMembers.map((member, midx) => (
                            <td
                              key={midx}
                              className="py-1 sm:py-2 px-1 sm:px-3 text-right"
                            >
                              {parseInt(row[member.name] || "0")}
                            </td>
                          ))}
                          <td className="py-1 sm:py-2 px-1 sm:px-3 text-right font-bold">
                            {parseInt(row.totalIssued)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {showingTab === "cumulativeShares" && (
                <div className="overflow-x-auto">
                  <h3 className="text-base sm:text-lg font-medium mb-2">
                    누적 주식 수
                  </h3>
                  <table className="w-full text-xs sm:text-sm">
                    <thead>
                      <tr className="bg-gray-100">
                        <th className="py-1 sm:py-2 px-1 sm:px-3 text-left">
                          시점
                        </th>
                        {teamMembers.map((member, idx) => (
                          <th
                            key={idx}
                            className="py-1 sm:py-2 px-1 sm:px-3 text-right"
                          >
                            <div className="flex items-center justify-end gap-1 sm:gap-2">
                              <div
                                className="w-2 sm:w-3 h-2 sm:h-3 rounded-full"
                                style={{ backgroundColor: member.color }}
                              ></div>
                              <span className="whitespace-nowrap">
                                {member.name}
                              </span>
                            </div>
                          </th>
                        ))}
                        <th className="py-1 sm:py-2 px-1 sm:px-3 text-right font-bold">
                          총 발행량
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {results.cumulativeShares.map((row, idx) => (
                        <tr key={idx} className="border-t border-gray-200">
                          <td className="py-1 sm:py-2 px-1 sm:px-3">
                            {row.month === 0
                              ? "시작"
                              : `${monthToYearMonth(row.month)} 말`}
                          </td>
                          {teamMembers.map((member, midx) => (
                            <td
                              key={midx}
                              className="py-1 sm:py-2 px-1 sm:px-3 text-right"
                            >
                              {row[member.name]}
                              <span className="text-xs text-gray-500 ml-1 hidden sm:inline">
                                (
                                {(
                                  (parseFloat(row[member.name] || "0") /
                                    parseFloat(row.totalIssued)) *
                                  100
                                ).toFixed(2)}
                                %)
                              </span>
                            </td>
                          ))}
                          <td className="py-1 sm:py-2 px-1 sm:px-3 text-right font-bold">
                            {row.totalIssued}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {showingTab === "ownershipChart" && (
                <div>
                  <h3 className="text-base sm:text-lg font-medium mb-2 sm:mb-4">
                    시간별 지분율 변화
                  </h3>
                  <div className="h-60 sm:h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={results.chartData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis
                          dataKey="month"
                          tickFormatter={(value) => monthToYearMonth(value)}
                          label={{
                            value: "시간",
                            position: "insideBottom",
                            offset: -5,
                          }}
                        />
                        <YAxis
                          label={{
                            value: "지분율 (%)",
                            angle: -90,
                            position: "insideLeft",
                          }}
                          domain={[0, 100]}
                          tickFormatter={(value) => `${value}%`}
                        />
                        <Tooltip
                          formatter={(value: number) => [
                            `${value.toFixed(2)}%`,
                            "",
                          ]}
                          labelFormatter={(label) =>
                            `${monthToYearMonth(label)} 말`
                          }
                        />
                        <Legend />
                        {teamMembers.map((member, idx) => (
                          <Line
                            key={idx}
                            type="monotone"
                            dataKey={member.name}
                            name={member.name}
                            stroke={member.color}
                            activeDot={{ r: 6 }}
                            strokeWidth={2}
                          />
                        ))}
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {showingTab === "detailData" && (
                <div className="overflow-x-auto text-xs sm:text-sm">
                  <h3 className="text-base sm:text-lg font-medium mb-2">
                    상세 데이터
                  </h3>

                  {results.monthlySnapshots.map((snapshot, monthIndex) => (
                    <div key={monthIndex} className="mb-4 sm:mb-8">
                      <h4 className="text-sm sm:text-md font-semibold mb-2 bg-gray-100 p-1 sm:p-2">
                        {monthToYearMonth(snapshot.month)} 말
                      </h4>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 sm:gap-4 mb-2 sm:mb-4">
                        <div>
                          <h5 className="text-xs sm:text-sm font-medium mb-1">
                            누적 기여 점수
                          </h5>
                          <table className="w-full text-xs sm:text-sm">
                            <thead>
                              <tr className="bg-gray-50">
                                <th className="py-1 px-1 sm:px-2 text-left">
                                  구성원
                                </th>
                                <th className="py-1 px-1 sm:px-2 text-right">
                                  누적 개월
                                </th>
                                <th className="py-1 px-1 sm:px-2 text-right">
                                  비율
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {teamMembers.map((member, idx) => (
                                <tr
                                  key={idx}
                                  className="border-t border-gray-100"
                                >
                                  <td className="py-1 px-1 sm:px-2">
                                    <div className="flex items-center gap-1 sm:gap-2">
                                      <div
                                        className="w-2 h-2 rounded-full"
                                        style={{
                                          backgroundColor: member.color,
                                        }}
                                      ></div>
                                      {member.name}
                                    </div>
                                  </td>
                                  <td className="py-1 px-1 sm:px-2 text-right">
                                    {snapshot.contributionScores[member.name]}
                                  </td>
                                  <td className="py-1 px-1 sm:px-2 text-right">
                                    {(
                                      snapshot.targetShareRatios[member.name] *
                                      100
                                    ).toFixed(2)}
                                    %
                                  </td>
                                </tr>
                              ))}
                              <tr className="border-t border-gray-200 font-medium">
                                <td className="py-1 px-1 sm:px-2">합계</td>
                                <td className="py-1 px-1 sm:px-2 text-right">
                                  {snapshot.totalContribution}
                                </td>
                                <td className="py-1 px-1 sm:px-2 text-right">
                                  100%
                                </td>
                              </tr>
                            </tbody>
                          </table>
                        </div>

                        <div>
                          <h5 className="text-xs sm:text-sm font-medium mb-1">
                            주식 현황
                          </h5>
                          <table className="w-full text-xs sm:text-sm">
                            <thead>
                              <tr className="bg-gray-50">
                                <th className="py-1 px-1 sm:px-2 text-left">
                                  구성원
                                </th>
                                <th className="py-1 px-1 sm:px-2 text-right">
                                  신규 발행
                                </th>
                                <th className="py-1 px-1 sm:px-2 text-right">
                                  누적 보유
                                </th>
                                <th className="py-1 px-1 sm:px-2 text-right">
                                  지분율
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {teamMembers.map((member, idx) => (
                                <tr
                                  key={idx}
                                  className="border-t border-gray-100"
                                >
                                  <td className="py-1 px-1 sm:px-2">
                                    <div className="flex items-center gap-1 sm:gap-2">
                                      <div
                                        className="w-2 h-2 rounded-full"
                                        style={{
                                          backgroundColor: member.color,
                                        }}
                                      ></div>
                                      {member.name}
                                    </div>
                                  </td>
                                  <td className="py-1 px-1 sm:px-2 text-right">
                                    {snapshot.newSharesPerMember[member.name]}
                                  </td>
                                  <td className="py-1 px-1 sm:px-2 text-right">
                                    {snapshot.cumulativeShares[member.name]}
                                  </td>
                                  <td className="py-1 px-1 sm:px-2 text-right">
                                    {(
                                      (snapshot.cumulativeShares[member.name] /
                                        snapshot.totalSharesIssued) *
                                      100
                                    ).toFixed(2)}
                                    %
                                  </td>
                                </tr>
                              ))}
                              <tr className="border-t border-gray-200 font-medium">
                                <td className="py-1 px-1 sm:px-2">합계</td>
                                <td className="py-1 px-1 sm:px-2 text-right">
                                  {snapshot.newSharesIssued}
                                </td>
                                <td className="py-1 px-1 sm:px-2 text-right">
                                  {snapshot.totalSharesIssued}
                                </td>
                                <td className="py-1 px-1 sm:px-2 text-right">
                                  100%
                                </td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      </div>

                      <div>
                        <h5 className="text-xs sm:text-sm font-medium mb-1">
                          검증
                        </h5>
                        <div className="bg-blue-50 p-2 sm:p-3 rounded text-xs sm:text-sm">
                          {teamMembers.map((member, idx) => {
                            // Founders should have at least 10%
                            const expectedMinRatio =
                              member.name === "Founder" ? 0.1 : 0;
                            const shareRatio =
                              snapshot.cumulativeShares[member.name] /
                              snapshot.totalSharesIssued;

                            // Other members
                            const contributionRatio =
                              snapshot.totalContribution > 0
                                ? (snapshot.contributionScores[member.name] /
                                    snapshot.totalContribution) *
                                  0.9
                                : 0;

                            // Adjusted for real-world rounding errors
                            const difference =
                              shareRatio - expectedMinRatio - contributionRatio;

                            return (
                              <div
                                key={idx}
                                className="flex flex-col sm:flex-row sm:justify-between mb-1"
                              >
                                <span>
                                  {member.name}: 보유 주식 비율 ={" "}
                                  {(shareRatio * 100).toFixed(2)}%, 기여도 비율
                                  = {(contributionRatio * 100).toFixed(2)}%{" "}
                                  {member.name === "Founder" &&
                                    " + 창업자 고정 지분 10%"}
                                </span>
                                <span
                                  className={
                                    Math.abs(difference) < 0.01
                                      ? "text-green-600 font-medium"
                                      : "text-red-600 font-medium"
                                  }
                                >
                                  {Math.abs(difference) < 0.01
                                    ? `✓ 일치 (${(difference * 100).toFixed(2)}%)`
                                    : `✗ 불일치 (${(difference * 100).toFixed(2)}%)`}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
