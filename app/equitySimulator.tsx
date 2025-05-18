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

export default function EquitySimulator() {
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([
    { name: "Founder", joinMonth: 0, exitMonth: null, color: "#3498db" },
    { name: "A", joinMonth: 3, exitMonth: null, color: "#2ecc71" },
    { name: "B", joinMonth: 6, exitMonth: null, color: "#e74c3c" },
    { name: "C", joinMonth: 12, exitMonth: null, color: "#f39c12" },
    { name: "D", joinMonth: 24, exitMonth: null, color: "#9b59b6" },
  ]);
  const [simulationMonths, setSimulationMonths] = useState(36);
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

    // Initial shares: Founder starts with 10000 shares (representing 10% reserved)
    let totalSharesIssued = 10000;
    let previousMonthShares: Record<string, number> = {};

    teamMembers.forEach((member) => {
      previousMonthShares[member.name] = member.name === "Founder" ? 10000 : 0;
    });

    // Show starting point (month 0)
    simulationResults.cumulativeShares.push({
      month: 0,
      totalIssued: totalSharesIssued.toFixed(2),
      ...Object.keys(previousMonthShares).reduce(
        (acc, memberName) => {
          acc[memberName] = previousMonthShares[memberName].toFixed(2);
          return acc;
        },
        {} as Record<string, string>
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
          monthsContributed > 0 ? monthsContributed : 0;
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
                (1 - FIXED_FOUNDER_RATIO)
              : 0;

          // Founder gets 10% plus their share of the 90% based on contribution
          targetShareRatios[member.name] =
            FIXED_FOUNDER_RATIO + founderContribRatio;
        } else {
          // Others share the remaining 90% based on contribution
          targetShareRatios[member.name] =
            totalContribution > 0
              ? (contributionScores[member.name] / totalContribution) *
                (1 - FIXED_FOUNDER_RATIO)
              : 0;
        }
      });

      totalSharesIssued = Math.round(
        previousMonthShares["Founder"] / targetShareRatios["Founder"]
      );

      // Calculate how many shares each member should have based on target ratio
      teamMembers.forEach((member) => {
        targetShares[member.name] = Math.round(
          targetShareRatios[member.name] * totalSharesIssued
        );

        // Calculate how many new shares needed (we never take shares away)
        newSharesPerMember[member.name] = Math.max(
          0,
          targetShares[member.name] - previousMonthShares[member.name]
        );

        newSharesNeeded += newSharesPerMember[member.name];
      });

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
        totalIssued: newSharesNeeded.toFixed(2),
        ...Object.keys(newSharesPerMember).reduce(
          (acc, memberName) => {
            acc[memberName] = newSharesPerMember[memberName].toFixed(2);

            return acc;
          },
          {} as Record<string, string>
        ),
      });

      // Format cumulative shares data for table
      simulationResults.cumulativeShares.push({
        month: actualMonthEnd,
        year:
          Math.floor(actualMonthEnd / 12) + (actualMonthEnd % 12 > 0 ? 1 : 0),
        totalIssued: totalSharesIssued.toFixed(2),
        ...Object.keys(previousMonthShares).reduce(
          (acc, memberName) => {
            acc[memberName] = previousMonthShares[memberName].toFixed(2);

            return acc;
          },
          {} as Record<string, string>
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
    <div className="flex flex-col p-6 max-w-6xl mx-auto bg-gray-50 min-h-screen">
      <h1 className="text-3xl font-bold text-center mb-6 text-blue-800">
        주식 분배 시뮬레이터
      </h1>

      <div className="flex flex-col md:flex-row gap-6">
        <div className="md:w-64 bg-white p-4 rounded-lg shadow-md self-start sticky top-6">
          <h2 className="text-lg font-semibold mb-3 text-blue-800 border-b pb-2">
            정책 사항
          </h2>
          <ul className="list-disc pl-5 space-y-2 text-sm">
            <li>창업 시 창업자는 10,000주 보유 (100%)</li>
            <li>대표(창업자) 고정 지분 10%</li>
            <li>나머지 90%는 모든 구성원의 기여도에 따라 분배</li>
            <li>기여도는 근무 개월 수로 측정</li>
            <li>
              연말마다 모든 구성원의 주식 비율을 누적 기여도 비율에 맞추기 위해
              신주 발행 후 분배
            </li>
            <li>이미 발행된 주식은 회수하지 않음</li>
            <li>퇴사자는 퇴사 시점까지만 기여도 인정</li>
          </ul>
        </div>

        <div className="flex-1">
          <div className="bg-white p-6 rounded-lg shadow-md mb-6">
            <h2 className="text-xl font-semibold mb-4">팀 구성 및 설정</h2>

            <div className="mb-4">
              <label
                htmlFor="simulation-months"
                className="block text-sm font-medium mb-1"
              >
                시뮬레이션 기간 (개월)
              </label>
              <div className="flex items-center gap-4">
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
                <span className="text-sm font-medium whitespace-nowrap">
                  {simulationMonths}개월 ({Math.floor(simulationMonths / 12)}년)
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
                <div className="flex flex-wrap gap-4 mb-4 p-3 bg-blue-50 rounded">
                  <input
                    type="text"
                    placeholder="이름"
                    value={newMember.name}
                    onChange={(e) =>
                      setNewMember({ ...newMember, name: e.target.value })
                    }
                    className="flex-1 min-w-[120px] p-2 border rounded"
                  />
                  <div className="flex-1 min-w-[120px]">
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
                      className="w-full p-2 border rounded"
                      min="0"
                    />
                  </div>
                  <div className="flex-1 min-w-[120px]">
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
                      className="w-full p-2 border rounded"
                      min={newMember.joinMonth || 0}
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
                                handleUpdateMember(
                                  index,
                                  "name",
                                  e.target.value
                                )
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
                              ({monthToYearMonth(member.joinMonth)})
                            </span>
                          </div>
                        </td>
                        <td className="py-2 px-3">
                          <div className="flex items-center gap-2">
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
                              className="border-b border-gray-300 bg-transparent w-16 mr-2"
                              min={member.joinMonth}
                              placeholder="없음"
                            />
                            {member.exitMonth !== null && (
                              <span className="text-xs text-gray-500">
                                근무 기간: (
                                {monthToYearMonth(
                                  member.exitMonth - member.joinMonth
                                )}
                                )
                              </span>
                            )}
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
                    onClick={() => setShowingTab("monthlyShares")}
                    className={`px-3 py-1 rounded ${
                      showingTab === "monthlyShares"
                        ? "bg-blue-500 text-white"
                        : "bg-gray-200"
                    }`}
                  >
                    연간 발행량
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

              {showingTab === "monthlyShares" && (
                <div className="overflow-x-auto">
                  <h3 className="text-lg font-medium mb-2">연간 신주 발행량</h3>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-100">
                        <th className="py-2 px-3 text-left">연차</th>
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
                      {results.monthlyShares.map((row, idx) => (
                        <tr key={idx} className="border-t border-gray-200">
                          <td className="py-2 px-3">
                            {monthToYearMonth(row.month)}
                          </td>
                          {teamMembers.map((member, midx) => (
                            <td key={midx} className="py-2 px-3 text-right">
                              {parseInt(row[member.name] || "0")}
                            </td>
                          ))}
                          <td className="py-2 px-3 text-right font-bold">
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
                  <h3 className="text-lg font-medium mb-2">누적 주식 수</h3>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-100">
                        <th className="py-2 px-3 text-left">시점</th>
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
                          <td className="py-2 px-3">
                            {row.month === 0
                              ? "시작"
                              : `${monthToYearMonth(row.month)} 말`}
                          </td>
                          {teamMembers.map((member, midx) => (
                            <td key={midx} className="py-2 px-3 text-right">
                              {parseInt(row[member.name] || "0")}
                              <span className="text-xs text-gray-500 ml-1">
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
                          <td className="py-2 px-3 text-right font-bold">
                            {parseInt(row.totalIssued)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {showingTab === "ownershipChart" && (
                <div>
                  <h3 className="text-lg font-medium mb-4">
                    시간별 지분율 변화
                  </h3>
                  <div className="h-80">
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

                  {results.monthlySnapshots.map((snapshot, monthIndex) => (
                    <div key={monthIndex} className="mb-8">
                      <h4 className="text-md font-semibold mb-2 bg-gray-100 p-2">
                        {monthToYearMonth(snapshot.month)} 말
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
                                <th className="py-1 px-2 text-right">
                                  누적 개월
                                </th>
                                <th className="py-1 px-2 text-right">비율</th>
                              </tr>
                            </thead>
                            <tbody>
                              {teamMembers.map((member, idx) => (
                                <tr
                                  key={idx}
                                  className="border-t border-gray-100"
                                >
                                  <td className="py-1 px-2">
                                    <div className="flex items-center gap-2">
                                      <div
                                        className="w-2 h-2 rounded-full"
                                        style={{
                                          backgroundColor: member.color,
                                        }}
                                      ></div>
                                      {member.name}
                                    </div>
                                  </td>
                                  <td className="py-1 px-2 text-right">
                                    {snapshot.contributionScores[member.name]}
                                  </td>
                                  <td className="py-1 px-2 text-right">
                                    {(
                                      snapshot.targetShareRatios[member.name] *
                                      100
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
                          <h5 className="text-sm font-medium mb-1">
                            주식 현황
                          </h5>
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="bg-gray-50">
                                <th className="py-1 px-2 text-left">구성원</th>
                                <th className="py-1 px-2 text-right">
                                  신규 발행
                                </th>
                                <th className="py-1 px-2 text-right">
                                  누적 보유
                                </th>
                                <th className="py-1 px-2 text-right">지분율</th>
                              </tr>
                            </thead>
                            <tbody>
                              {teamMembers.map((member, idx) => (
                                <tr
                                  key={idx}
                                  className="border-t border-gray-100"
                                >
                                  <td className="py-1 px-2">
                                    <div className="flex items-center gap-2">
                                      <div
                                        className="w-2 h-2 rounded-full"
                                        style={{
                                          backgroundColor: member.color,
                                        }}
                                      ></div>
                                      {member.name}
                                    </div>
                                  </td>
                                  <td className="py-1 px-2 text-right">
                                    {snapshot.newSharesPerMember[member.name]}
                                  </td>
                                  <td className="py-1 px-2 text-right">
                                    {snapshot.cumulativeShares[member.name]}
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
                                  {snapshot.newSharesIssued}
                                </td>
                                <td className="py-1 px-2 text-right">
                                  {snapshot.totalSharesIssued}
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
                            // Founders should have at least 10%
                            const expectedMinRatio =
                              member.name === "Founder" ? 0.1 : 0;
                            const shareRatio =
                              snapshot.cumulativeShares[member.name] /
                              snapshot.totalSharesIssued;

                            // Founder checking
                            if (member.name === "Founder") {
                              return (
                                <div
                                  key={idx}
                                  className="flex justify-between mb-1"
                                >
                                  <span>
                                    {member.name}: 보유 주식 비율 ={" "}
                                    {(shareRatio * 100).toFixed(2)}%
                                  </span>
                                  <span
                                    className={
                                      shareRatio >= 0.1
                                        ? "text-green-600 font-medium"
                                        : "text-red-600 font-medium"
                                    }
                                  >
                                    {shareRatio >= 0.1
                                      ? "✓ 10% 이상 보유"
                                      : `✗ 10% 미만 보유 (${(shareRatio * 100).toFixed(2)}%)`}
                                  </span>
                                </div>
                              );
                            }

                            // Other members
                            const contributionRatio =
                              snapshot.totalContribution > 0
                                ? (snapshot.contributionScores[member.name] /
                                    snapshot.totalContribution) *
                                  0.9
                                : 0;

                            // Adjusted for real-world rounding errors
                            const difference = Math.abs(
                              shareRatio - expectedMinRatio - contributionRatio
                            );

                            return (
                              <div
                                key={idx}
                                className="flex justify-between mb-1"
                              >
                                <span>
                                  {member.name}: 보유 주식 비율 ={" "}
                                  {(shareRatio * 100).toFixed(2)}%, 기여도 비율
                                  = {(contributionRatio * 100).toFixed(2)}%
                                </span>
                                <span
                                  className={
                                    difference < 0.001
                                      ? "text-green-600 font-medium"
                                      : "text-red-600 font-medium"
                                  }
                                >
                                  {difference < 0.001
                                    ? "✓ 일치"
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
