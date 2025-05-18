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

interface TeamMember {
  name: string;
  joinMonth: number;
  exitMonth: number | null;
  color: string;
}

interface SimulationResults {
  yearlySnapshots: any[];
  memberSnapshots: Record<string, any[]>;
  yearlyShares: any[];
  cumulativeShares: any[];
  chartData: any[];
}

export default function EquitySimulator() {
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([
    { name: "Founder", joinMonth: 0, exitMonth: null, color: "#3498db" },
    { name: "A", joinMonth: 3, exitMonth: null, color: "#2ecc71" },
    { name: "B", joinMonth: 6, exitMonth: 24, color: "#e74c3c" },
    { name: "C", joinMonth: 12, exitMonth: null, color: "#f39c12" },
    { name: "D", joinMonth: 24, exitMonth: null, color: "#9b59b6" },
  ]);
  const [simulationMonths, setSimulationMonths] = useState(36);
  const [results, setResults] = useState<SimulationResults | null>(null);
  const [showingTab, setShowingTab] = useState("yearlyShares");
  const [showAddMember, setShowAddMember] = useState(false);
  const [newMember, setNewMember] = useState<{
    name: string;
    joinMonth: number;
    exitMonth: number | null;
  }>({ name: "", joinMonth: 0, exitMonth: null });

  const calculateYearlyResults = () => {
    const yearCount = Math.ceil(simulationMonths / 12);
    const years = Array.from({ length: yearCount }, (_, i) => (i + 1) * 12);

    // Initialize results structure
    const simulationResults: SimulationResults = {
      yearlySnapshots: [],
      memberSnapshots: {},
      yearlyShares: [],
      cumulativeShares: [],
      chartData: [],
    };

    // Initialize member data
    teamMembers.forEach((member) => {
      simulationResults.memberSnapshots[member.name] = [];
    });

    let previousYearShares: Record<string, number> = {};
    teamMembers.forEach((member) => {
      previousYearShares[member.name] = member.name === "Founder" ? 10000 : 0;
    });

    let totalSharesIssued = 10000; // Start with 10000 shares for Founder
    const FOUNDER_MIN_OWNERSHIP = 0.1; // 10% minimum ownership for founder

    // For each year
    years.forEach((yearEndMonth, yearIndex) => {
      const actualYearEnd = Math.min(yearEndMonth, simulationMonths);

      // Calculate cumulative contribution scores for each member
      const contributionScores: Record<string, number> = {};
      let totalContribution = 0;

      teamMembers.forEach((member) => {
        // Skip if not joined yet or already left
        if (
          member.joinMonth >= actualYearEnd ||
          (member.exitMonth !== null && member.exitMonth <= actualYearEnd - 12)
        ) {
          contributionScores[member.name] = 0;
          return;
        }

        // Calculate months contributed in this year
        const yearStartMonth = actualYearEnd - 12;
        const effectiveStartMonth = Math.max(yearStartMonth, member.joinMonth);
        const effectiveEndMonth =
          member.exitMonth !== null
            ? Math.min(actualYearEnd, member.exitMonth)
            : actualYearEnd;

        const monthsContributed = Math.max(
          0,
          effectiveEndMonth - effectiveStartMonth
        );
        contributionScores[member.name] = monthsContributed;
        totalContribution += monthsContributed;
      });

      // Skip year if no contribution (except first year)
      if (totalContribution === 0 && yearIndex > 0) {
        return;
      }

      // Calculate target share counts based on contribution ratios
      const targetShareRatios: Record<string, number> = {};
      const targetShares: Record<string, number> = {};
      let newSharesNeeded = 0;
      let newSharesPerMember: Record<string, number> = {};

      // First year - only founder gets shares
      if (yearIndex === 0) {
        teamMembers.forEach((member) => {
          targetShareRatios[member.name] = member.name === "Founder" ? 1 : 0;
          targetShares[member.name] = previousYearShares[member.name];
          newSharesPerMember[member.name] = 0;
        });
      } else {
        // Calculate shares for remaining 90% based on contribution
        const remainingOwnershipRatio = 1 - FOUNDER_MIN_OWNERSHIP;

        teamMembers.forEach((member) => {
          if (member.name === "Founder") {
            // Founder gets minimum 10% plus contribution-based share from remaining 90%
            const founderContributionRatio =
              totalContribution > 0
                ? (contributionScores[member.name] / totalContribution) *
                  remainingOwnershipRatio
                : 0;
            targetShareRatios[member.name] =
              FOUNDER_MIN_OWNERSHIP + founderContributionRatio;
          } else {
            // Other members get shares from remaining 90% based on contribution
            targetShareRatios[member.name] =
              totalContribution > 0
                ? (contributionScores[member.name] / totalContribution) *
                  remainingOwnershipRatio
                : 0;
          }

          // Calculate target shares and new shares needed
          const targetShareCount = Math.floor(
            targetShareRatios[member.name] * totalSharesIssued
          );
          targetShares[member.name] = targetShareCount;
          newSharesPerMember[member.name] = Math.max(
            0,
            targetShareCount - previousYearShares[member.name]
          );
          newSharesNeeded += newSharesPerMember[member.name];
        });
      }

      // Update total shares issued
      totalSharesIssued += newSharesNeeded;

      // Update previous year shares for next iteration
      teamMembers.forEach((member) => {
        previousYearShares[member.name] =
          previousYearShares[member.name] + newSharesPerMember[member.name];
      });

      // Store yearly snapshot
      simulationResults.yearlySnapshots.push({
        year: yearIndex + 1,
        monthEnd: actualYearEnd,
        contributionScores: { ...contributionScores },
        targetShareRatios: { ...targetShareRatios },
        newSharesPerMember: { ...newSharesPerMember },
        cumulativeShares: { ...previousYearShares },
        totalContribution,
        newSharesIssued: newSharesNeeded,
        totalSharesIssued,
      });

      // Store member snapshots
      teamMembers.forEach((member) => {
        simulationResults.memberSnapshots[member.name].push({
          year: yearIndex + 1,
          contributionScore: contributionScores[member.name],
          contributionRatio: targetShareRatios[member.name],
          newShares: newSharesPerMember[member.name],
          cumulativeShares: previousYearShares[member.name],
          ownershipPercentage:
            (previousYearShares[member.name] / totalSharesIssued) * 100,
        });
      });

      // Format yearly shares data for table
      simulationResults.yearlyShares.push({
        year: yearIndex + 1,
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
        year: yearIndex + 1,
        totalIssued: totalSharesIssued,
        ...Object.keys(previousYearShares).reduce(
          (acc, memberName) => {
            acc[memberName] = previousYearShares[memberName];
            return acc;
          },
          {} as Record<string, number>
        ),
      });
    });

    // Prepare chart data
    simulationResults.chartData = simulationResults.yearlySnapshots.map(
      (snapshot) => {
        const yearData: Record<string, any> = {
          year: snapshot.year,
        };

        teamMembers.forEach((member) => {
          yearData[member.name] =
            (snapshot.cumulativeShares[member.name] /
              snapshot.totalSharesIssued) *
            100;
        });

        return yearData;
      }
    );

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
        joinMonth: Number(newMember.joinMonth),
        exitMonth: newMember.exitMonth ? Number(newMember.exitMonth) : null,
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

  const handleUpdateMember = (index: number, field: string, value: string) => {
    const newTeamMembers = [...teamMembers];
    if (field === "joinMonth" || field === "exitMonth") {
      newTeamMembers[index] = {
        ...newTeamMembers[index],
        [field]: value === "" ? null : Number(value),
      };
    } else {
      newTeamMembers[index] = {
        ...newTeamMembers[index],
        [field]: value,
      };
    }
    setTeamMembers(newTeamMembers);
  };

  const runSimulation = () => {
    const results = calculateYearlyResults();
    setResults(results);
  };

  useEffect(() => {
    runSimulation();
  }, []);

  const monthToQuarterYear = (months: number) => {
    const years = Math.floor(months / 12);
    const remainingMonths = months % 12;

    if (remainingMonths === 0) {
      return `${years}년`;
    } else {
      return `${years}년 ${remainingMonths}개월`;
    }
  };

  return (
    <div className="flex flex-col mx-auto bg-gray-50 min-h-screen p-6 text-black">
      <h1 className="text-3xl font-bold text-center mb-6 text-blue-800">
        주식 기여도 시뮬레이터
      </h1>

      <div className="bg-white p-6 rounded-lg shadow-md mb-6">
        <h2 className="text-xl font-semibold mb-4">팀 구성 및 설정</h2>

        <div className="mb-4">
          <label
            htmlFor="simulationMonths"
            className="block text-sm font-medium mb-1"
          >
            시뮬레이션 기간
          </label>
          <div className="flex items-center gap-4">
            <input
              id="simulationMonths"
              type="range"
              min="12"
              max="120"
              step="12"
              value={simulationMonths}
              onChange={(e) => setSimulationMonths(Number(e.target.value))}
              className="w-full"
            />
            <span className="text-sm font-medium w-32">
              {simulationMonths}개월 ({monthToQuarterYear(simulationMonths)})
            </span>
          </div>
        </div>

        <div className="mb-4">
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-md font-medium">팀 구성원</h3>
            <button
              onClick={() => setShowAddMember(!showAddMember)}
              className="text-sm bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded"
            >
              {showAddMember ? "취소" : "구성원 추가"}
            </button>
          </div>

          {showAddMember && (
            <div className="flex gap-4 mb-4 p-3 bg-blue-50 rounded">
              <input
                type="text"
                placeholder="이름"
                value={newMember.name}
                onChange={(e) =>
                  setNewMember({ ...newMember, name: e.target.value })
                }
                className="flex-1 p-2 border rounded"
              />
              <div className="flex-1">
                <input
                  type="number"
                  placeholder="합류 개월"
                  value={newMember.joinMonth}
                  onChange={(e) =>
                    setNewMember({
                      ...newMember,
                      joinMonth: Number(e.target.value),
                    })
                  }
                  className="w-full p-2 border rounded"
                />
              </div>
              <div className="flex-1">
                <input
                  type="number"
                  placeholder="퇴사 개월 (선택)"
                  value={newMember.exitMonth || ""}
                  onChange={(e) =>
                    setNewMember({
                      ...newMember,
                      exitMonth: e.target.value ? Number(e.target.value) : null,
                    })
                  }
                  className="w-full p-2 border rounded"
                />
              </div>
              <button
                onClick={handleAddMember}
                className="bg-green-500 hover:bg-green-600 text-white px-4 rounded"
              >
                추가
              </button>
            </div>
          )}

          <div className="bg-gray-100 rounded overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-200">
                  <th className="py-2 px-3 text-left">이름</th>
                  <th className="py-2 px-3 text-left">합류 시점</th>
                  <th className="py-2 px-3 text-left">퇴사 시점</th>
                  <th className="py-2 px-3 text-center w-16">액션</th>
                </tr>
              </thead>
              <tbody>
                {teamMembers.map((member, index) => (
                  <tr key={index} className="border-t border-gray-200">
                    <td className="py-2 px-3">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: member.color }}
                        ></div>
                        <input
                          type="text"
                          value={member.name}
                          onChange={(e) =>
                            handleUpdateMember(index, "name", e.target.value)
                          }
                          className="border-b border-gray-300 bg-transparent w-full"
                          disabled={index === 0}
                        />
                      </div>
                    </td>
                    <td className="py-2 px-3">
                      <div className="flex items-center gap-2">
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
                          className="border-b border-gray-300 bg-transparent w-16 mr-2"
                          min="0"
                          disabled={index === 0}
                        />
                        <span className="text-xs text-gray-500">
                          ({monthToQuarterYear(member.joinMonth)})
                        </span>
                      </div>
                    </td>
                    <td className="py-2 px-3">
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          value={member.exitMonth || ""}
                          onChange={(e) =>
                            handleUpdateMember(
                              index,
                              "exitMonth",
                              e.target.value
                            )
                          }
                          className="border-b border-gray-300 bg-transparent w-16 mr-2"
                          min="0"
                        />
                      </div>
                    </td>
                    <td className="py-2 px-3 text-center">
                      <button
                        onClick={() => handleRemoveMember(index)}
                        className="text-red-500 hover:text-red-700"
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
          className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-md font-medium"
        >
          시뮬레이션 실행
        </button>
      </div>

      {results && (
        <div className="bg-white p-6 rounded-lg shadow-md mb-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">시뮬레이션 결과</h2>
            <div className="flex gap-2">
              <button
                onClick={() => setShowingTab("yearlyShares")}
                className={`px-3 py-1 rounded ${
                  showingTab === "yearlyShares"
                    ? "bg-blue-500 text-white"
                    : "bg-gray-200"
                }`}
              >
                연도별 발행량
              </button>
              <button
                onClick={() => setShowingTab("cumulativeShares")}
                className={`px-3 py-1 rounded ${
                  showingTab === "cumulativeShares"
                    ? "bg-blue-500 text-white"
                    : "bg-gray-200"
                }`}
              >
                누적 주식
              </button>
              <button
                onClick={() => setShowingTab("ownershipChart")}
                className={`px-3 py-1 rounded ${
                  showingTab === "ownershipChart"
                    ? "bg-blue-500 text-white"
                    : "bg-gray-200"
                }`}
              >
                지분율 차트
              </button>
              <button
                onClick={() => setShowingTab("detailData")}
                className={`px-3 py-1 rounded ${
                  showingTab === "detailData"
                    ? "bg-blue-500 text-white"
                    : "bg-gray-200"
                }`}
              >
                상세 데이터
              </button>
            </div>
          </div>

          {showingTab === "yearlyShares" && (
            <div className="overflow-x-auto">
              <h3 className="text-lg font-medium mb-2">연도별 신주 발행량</h3>
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="py-2 px-3 text-left">연도</th>
                    {teamMembers.map((member, idx) => (
                      <th key={idx} className="py-2 px-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: member.color }}
                          ></div>
                          {member.name}
                          {member.exitMonth && (
                            <span className="text-xs text-red-500">
                              ({monthToQuarterYear(member.exitMonth)} 퇴사)
                            </span>
                          )}
                        </div>
                      </th>
                    ))}
                    <th className="py-2 px-3 text-right font-bold">
                      총 발행량
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {results.yearlyShares.map((row, idx) => (
                    <tr key={idx} className="border-t border-gray-200">
                      <td className="py-2 px-3">{row.year}년차</td>
                      {teamMembers.map((member, midx) => (
                        <td key={midx} className="py-2 px-3 text-right">
                          {row[member.name].toLocaleString()}
                        </td>
                      ))}
                      <td className="py-2 px-3 text-right font-bold">
                        {row.totalIssued.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {showingTab === "cumulativeShares" && (
            <div className="overflow-x-auto">
              <h3 className="text-lg font-medium mb-2">누적 주식 수</h3>
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="py-2 px-3 text-left">연도</th>
                    {teamMembers.map((member, idx) => (
                      <th key={idx} className="py-2 px-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: member.color }}
                          ></div>
                          {member.name}
                        </div>
                      </th>
                    ))}
                    <th className="py-2 px-3 text-right font-bold">
                      총 발행량
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {results.cumulativeShares.map((row, idx) => (
                    <tr key={idx} className="border-t border-gray-200">
                      <td className="py-2 px-3">{row.year}년차 말</td>
                      {teamMembers.map((member, midx) => (
                        <td key={midx} className="py-2 px-3 text-right">
                          {parseFloat(row[member.name]).toLocaleString(
                            undefined,
                            {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            }
                          )}
                          <span className="text-xs text-gray-500 ml-1">
                            (
                            {(
                              (parseFloat(row[member.name]) /
                                parseFloat(row.totalIssued)) *
                              100
                            ).toFixed(2)}
                            %)
                          </span>
                        </td>
                      ))}
                      <td className="py-2 px-3 text-right font-bold">
                        {parseFloat(row.totalIssued).toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {showingTab === "ownershipChart" && (
            <div>
              <h3 className="text-lg font-medium mb-4">연도별 지분율 변화</h3>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={results.chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="year"
                      label={{
                        value: "연도",
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
                      labelFormatter={(label) => `${label}년차 말`}
                    />
                    <Legend />
                    {teamMembers.map((member, idx) => (
                      <Line
                        key={idx}
                        type="monotone"
                        dataKey={member.name}
                        name={member.name}
                        stroke={member.color}
                        activeDot={{ r: 8 }}
                        strokeWidth={2}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {showingTab === "detailData" && (
            <div className="overflow-x-auto">
              <h3 className="text-lg font-medium mb-2">상세 데이터</h3>

              {results.yearlySnapshots.map((snapshot, yearIndex) => (
                <div key={yearIndex} className="mb-8">
                  <h4 className="text-md font-semibold mb-2 bg-gray-100 p-2">
                    {yearIndex + 1}년차 말 (주 {snapshot.monthEnd})
                  </h4>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div>
                      <h5 className="text-sm font-medium mb-1">
                        누적 기여 점수
                      </h5>
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-gray-50">
                            <th className="py-1 px-2 text-left">구성원</th>
                            <th className="py-1 px-2 text-right">누적 점수</th>
                            <th className="py-1 px-2 text-right">비율</th>
                          </tr>
                        </thead>
                        <tbody>
                          {teamMembers.map((member, idx) => (
                            <tr key={idx} className="border-t border-gray-100">
                              <td className="py-1 px-2">
                                <div className="flex items-center gap-2">
                                  <div
                                    className="w-2 h-2 rounded-full"
                                    style={{ backgroundColor: member.color }}
                                  ></div>
                                  {member.name}
                                </div>
                              </td>
                              <td className="py-1 px-2 text-right">
                                {snapshot.contributionScores[member.name]}
                              </td>
                              <td className="py-1 px-2 text-right">
                                {(
                                  snapshot.targetShareRatios[member.name] * 100
                                ).toFixed(2)}
                                %
                              </td>
                            </tr>
                          ))}
                          <tr className="border-t border-gray-200 font-medium">
                            <td className="py-1 px-2">합계</td>
                            <td className="py-1 px-2 text-right">
                              {snapshot.totalContribution}
                            </td>
                            <td className="py-1 px-2 text-right">100%</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    <div>
                      <h5 className="text-sm font-medium mb-1">주식 현황</h5>
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-gray-50">
                            <th className="py-1 px-2 text-left">구성원</th>
                            <th className="py-1 px-2 text-right">신규 발행</th>
                            <th className="py-1 px-2 text-right">누적 보유</th>
                            <th className="py-1 px-2 text-right">지분율</th>
                          </tr>
                        </thead>
                        <tbody>
                          {teamMembers.map((member, idx) => (
                            <tr key={idx} className="border-t border-gray-100">
                              <td className="py-1 px-2">
                                <div className="flex items-center gap-2">
                                  <div
                                    className="w-2 h-2 rounded-full"
                                    style={{ backgroundColor: member.color }}
                                  ></div>
                                  {member.name}
                                </div>
                              </td>
                              <td className="py-1 px-2 text-right">
                                {snapshot.newSharesPerMember[
                                  member.name
                                ].toFixed(2)}
                              </td>
                              <td className="py-1 px-2 text-right">
                                {snapshot.cumulativeShares[member.name].toFixed(
                                  2
                                )}
                              </td>
                              <td className="py-1 px-2 text-right">
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
                            <td className="py-1 px-2">합계</td>
                            <td className="py-1 px-2 text-right">
                              {snapshot.newSharesIssued.toFixed(2)}
                            </td>
                            <td className="py-1 px-2 text-right">
                              {snapshot.totalSharesIssued.toFixed(2)}
                            </td>
                            <td className="py-1 px-2 text-right">100%</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div>
                    <h5 className="text-sm font-medium mb-1">검증</h5>
                    <div className="bg-blue-50 p-3 rounded text-sm">
                      {teamMembers.map((member, idx) => {
                        const shareRatio =
                          snapshot.cumulativeShares[member.name] /
                          snapshot.totalSharesIssued;
                        const contributionRatio =
                          snapshot.contributionScores[member.name] /
                          snapshot.totalContribution;
                        const difference = Math.abs(
                          shareRatio - contributionRatio
                        );

                        return (
                          <div key={idx} className="flex justify-between mb-1">
                            <span>
                              {member.name}: 보유 주식 비율 ={" "}
                              {(shareRatio * 100).toFixed(6)}%, 기여도 비율 ={" "}
                              {(contributionRatio * 100).toFixed(6)}%
                            </span>
                            <span
                              className={
                                difference < 0.0001
                                  ? "text-green-600 font-medium"
                                  : "text-red-600 font-medium"
                              }
                            >
                              {difference < 0.0001
                                ? "✓ 일치"
                                : `✗ 불일치 (${(difference * 100).toFixed(
                                    6
                                  )}%)`}
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
  );
}
