import { useEffect, useState } from "react";
import "./App.css";

const API_BASE_URL = "http://127.0.0.1:8000";

type FoundationOverview = {
  organizations: number;
  departments: number;
  users: number;
  roles: number;
  services: number;
  systems: number;
  dependencies: number;
  incidents: number;
  risk_rules: number;
};

type DashboardOverview = {
  total_changes: number;
  pending_approval: number;
  approved: number;
  rejected: number;
  needs_more_information: number;
  critical_risk: number;
  high_risk: number;
  medium_risk: number;
  low_risk: number;
  average_impact_score: number;
};

type ITSystem = {
  id: number;
  name: string;
  system_type?: string;
  environment: string;
  criticality: string;
  status: string;
};

type Department = {
  id: number;
  organization_id: number;
  name: string;
  description?: string;
};

type SystemDependency = {
  id: number;
  source_system_id: number;
  target_system_id: number;
  dependency_type: string;
  impact_level: string;
  description?: string;
};

type HistoricalIncident = {
  id: number;
  system_id: number;
  title: string;
  description?: string;
  severity: string;
  status: string;
  occurred_at: string;
  resolved_at?: string | null;
};

type RiskRule = {
  id: number;
  name: string;
  condition_type: string;
  condition_value: string;
  score: number;
  description?: string;
  is_active: string;
};

type LatestAssessment = {
  risk_level: string;
  impact_score: number;
  decision_recommendation: string;
  directly_affected_systems: string[];
  indirectly_affected_systems: string[];
  affected_departments: string[];
  system_owners: string[];
  previous_incidents: string[];
  risk_factors: string[];
  recommendations: string[];
  rollback_plan: string[];
  testing_checklist: string[];
  ai_explanation: string;
};

type ManagedChange = {
  id: number;
  title: string;
  description: string;
  change_type: string;
  change_mode: string;
  priority: string;
  status: string;
  expected_downtime_minutes: number;
  rollback_complexity: string;
  security_sensitivity: string;
  business_justification?: string;
  planned_start?: string;
  planned_end?: string;
  affected_system_ids: number[];
  latest_assessment: LatestAssessment | null;
};

type StatusHistoryItem = {
  old_status: string | null;
  new_status: string;
  changed_by: number | null;
  comment: string | null;
  changed_at: string;
};

type AuditLogItem = {
  action: string;
  entity_type: string;
  entity_id: number | null;
  actor_id: number | null;
  details: string | null;
  created_at: string;
};

type ApprovalItem = {
  approval_id: number;
  change_request_id: number;
  approver_id: number | null;
  approval_level: string;
  decision: string;
  comments: string | null;
  decided_at: string;
};

type NewChangeForm = {
  title: string;
  description: string;
  change_type: string;
  change_mode: string;
  priority: string;
  affected_system_ids: number[];
  expected_downtime_minutes: number;
  rollback_complexity: string;
  security_sensitivity: string;
  business_justification: string;
  planned_start: string;
  planned_end: string;
};

const riskRuleValueOptions: Record<string, string[]> = {
  change_type: [
    "database",
    "application",
    "network",
    "security",
    "documentation",
  ],

  change_mode: [
    "Standard",
    "Normal",
    "Emergency",
  ],

  system_criticality: [
    "Low",
    "Medium",
    "High",
    "Critical",
  ],

  dependency_impact: [
    "Low",
    "Medium",
    "High",
    "Critical",
  ],

  previous_incident: [
    "Low",
    "Medium",
    "High",
    "Critical",
  ],

  expected_downtime: [
    "none",
    "under_30_minutes",
    "30_to_119_minutes",
    "120_minutes_or_more",
  ],

  rollback_complexity: [
    "low",
    "medium",
    "high",
  ],

  security_sensitivity: [
    "low",
    "medium",
    "high",
  ],
};

function App() {
  const [foundationOverview, setFoundationOverview] =
    useState<FoundationOverview | null>(null);
  const [dashboardOverview, setDashboardOverview] =
    useState<DashboardOverview | null>(null);
  const [systems, setSystems] = useState<ITSystem[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [incidents, setIncidents] = useState<HistoricalIncident[]>([]);
const [riskRules, setRiskRules] = useState<RiskRule[]>([]);

const [newRiskRule, setNewRiskRule] = useState({
  name: "",
  condition_type: "change_type",
  condition_value: "database",
  score: 10,
  description: "",
  is_active: "active",
});
  const [newIncident, setNewIncident] = useState({
    system_id: "",
    title: "",
    description: "",
    severity: "Medium",
    status: "Resolved",
    occurred_at: "",
    resolved_at: "",
  });
  const [dependencies, setDependencies] = useState<SystemDependency[]>([]);

  const [newDependency, setNewDependency] = useState({
    source_system_id: "",
    target_system_id: "",
    dependency_type: "Application Dependency",
    impact_level: "Medium",
    description: "",
  });
  const [newConfigItem, setNewConfigItem] = useState({
  name: "",
  description: "",
  system_type: "Web Application",
  environment: "Production",
  criticality: "Medium",
  department_id: "",
});
  const [changes, setChanges] = useState<ManagedChange[]>([]);
  const [selectedChange, setSelectedChange] = useState<ManagedChange | null>(null);
  const [statusHistory, setStatusHistory] = useState<StatusHistoryItem[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);
  const [approvals, setApprovals] = useState<ApprovalItem[]>([]);
  const [view, setView] = useState<"dashboard" | "new" | "details" | "foundation">("dashboard");
  const [loading, setLoading] = useState(false);
  const [systemSearch, setSystemSearch] = useState("");

  const [form, setForm] = useState<NewChangeForm>({
    title: "",
    description: "",
    change_type: "database",
    change_mode: "Normal",
    priority: "Medium",
    affected_system_ids: [],
    expected_downtime_minutes: 0,
    rollback_complexity: "Medium",
    security_sensitivity: "Medium",
    business_justification: "",
    planned_start: "",
    planned_end: "",
  });

  async function loadData() {
    const foundationRes = await fetch(`${API_BASE_URL}/foundation/overview`);
    const foundationData = await foundationRes.json();
    setFoundationOverview(foundationData);

    const dashboardRes = await fetch(
      `${API_BASE_URL}/change-management/dashboard/overview`
    );
    const dashboardData = await dashboardRes.json();
    setDashboardOverview(dashboardData);

    const systemsRes = await fetch(`${API_BASE_URL}/foundation/systems`);
    const systemsData = await systemsRes.json();
    setSystems(systemsData);

    const departmentsRes = await fetch(`${API_BASE_URL}/foundation/departments`);
    const departmentsData = await departmentsRes.json();
    setDepartments(departmentsData);

    const dependenciesRes = await fetch(
      `${API_BASE_URL}/foundation/dependencies`
  );
    const dependenciesData = await dependenciesRes.json();
    setDependencies(dependenciesData);

    const incidentsRes = await fetch(
  `${API_BASE_URL}/foundation/incidents`
  );
  const incidentsData = await incidentsRes.json();
  setIncidents(incidentsData);

  const changesRes = await fetch(`${API_BASE_URL}/change-management/requests`);
  const changesData = await changesRes.json();
  setChanges(changesData);

  const riskRulesRes = await fetch(
  `${API_BASE_URL}/foundation/risk-rules`
  );
  const riskRulesData = await riskRulesRes.json();
  setRiskRules(riskRulesData);
  }



  async function openChangeDetails(changeId: number) {
  const changeRes = await fetch(
    `${API_BASE_URL}/change-management/requests/${changeId}`
  );
  const changeData = await changeRes.json();

  const historyRes = await fetch(
    `${API_BASE_URL}/change-management/requests/${changeId}/history`
  );
  const historyData = await historyRes.json();

  const auditRes = await fetch(
    `${API_BASE_URL}/change-management/requests/${changeId}/audit-logs`
  );
  const auditData = await auditRes.json();

  const approvalsRes = await fetch(
    `${API_BASE_URL}/change-management/requests/${changeId}/approvals`
  );
  const approvalsData = await approvalsRes.json();

  setSelectedChange(changeData);
  setStatusHistory(historyData);
  setAuditLogs(auditData);
  setApprovals(approvalsData);
  setView("details");
}

  useEffect(() => {
    loadData();
  }, []);

  async function createManagedChange() {
    if (!form.title || !form.description || form.affected_system_ids.length === 0) {
      alert("Please provide title, description, and select at least one directly affected configuration item.");
      return;
    }

    setLoading(true);

    const response = await fetch(`${API_BASE_URL}/change-management/requests`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        organization_id: 1,
        requester_id: 1,
        title: form.title,
        description: form.description,
        change_type: form.change_type,
        change_mode: form.change_mode,
        priority: form.priority,
        affected_system_ids: form.affected_system_ids,
        expected_downtime_minutes: Number(form.expected_downtime_minutes),
        rollback_complexity: form.rollback_complexity,
        security_sensitivity: form.security_sensitivity,
        business_justification: form.business_justification,
        planned_start: form.planned_start,
        planned_end: form.planned_end,
      }),
    });

    const data = await response.json();

    setLoading(false);

    if (!response.ok) {
      alert("Error creating change request.");
      console.log(data);
      return;
    }

    await openChangeDetails(data.id);

    setForm({
      title: "",
      description: "",
      change_type: "database",
      change_mode: "Normal",
      priority: "Medium",
      affected_system_ids: [],
      expected_downtime_minutes: 0,
      rollback_complexity: "Medium",
      security_sensitivity: "Medium",
      business_justification: "",
      planned_start: "",
      planned_end: "",
    });

    await loadData();
  }

  async function submitApproval(decision: string) {
    if (!selectedChange) return;

    const response = await fetch(
      `${API_BASE_URL}/change-management/requests/${selectedChange.id}/approvals`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          approver_id: 2,
          approval_level:
            selectedChange.latest_assessment?.risk_level === "Critical"
              ? "CAB Review"
              : "Manager Review",
          decision,
          comments: `Authorization decision submitted from ChangeFlow Governance dashboard: ${decision}`,
        }),
      }
    );

    if (!response.ok) {
      alert("Error submitting approval decision.");
      return;
    }

    await openChangeDetails(selectedChange.id);
    await loadData();
  }

  function getRiskClass(risk?: string) {
    if (!risk) return "";
    return risk.toLowerCase();
  }

  function getDecisionLabel(decision?: string) {
  if (!decision) return "N/A";

  if (decision === "Proceed") {
    return "Authorized to Proceed";
  }

  if (decision === "Proceed with Review") {
    return "Review Required Before Authorization";
  }

  if (decision === "Requires Manager Approval") {
    return "Management Authorization Required";
  }

  if (decision === "Do Not Proceed Without CAB Approval") {
    return "CAB Authorization Required";
  }

  return decision;
}
  function toggleAffectedSystem(systemId: number) {
  const isSelected = form.affected_system_ids.includes(systemId);

  const updatedSystems = isSelected
    ? form.affected_system_ids.filter((id) => id !== systemId)
    : [...form.affected_system_ids, systemId];

  setForm({
    ...form,
    affected_system_ids: updatedSystems,
  });
}

const filteredSystems = systems.filter((system) =>
  `${system.name} ${system.system_type || ""} ${system.criticality} ${system.environment}`
    .toLowerCase()
    .includes(systemSearch.toLowerCase())
);

async function createConfigurationItem() {
  if (!newConfigItem.name.trim()) {
    alert("Please enter configuration item name.");
    return;
  }

  const response = await fetch(`${API_BASE_URL}/foundation/systems`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      organization_id: 1,
      department_id: newConfigItem.department_id
        ? Number(newConfigItem.department_id)
        : null,
      service_id: null,
      owner_id: null,
      name: newConfigItem.name,
      description: newConfigItem.description,
      system_type: newConfigItem.system_type,
      environment: newConfigItem.environment,
      criticality: newConfigItem.criticality,
      status: "Active",
    }),
  });

  if (!response.ok) {
    alert("Error creating configuration item.");
    return;
  }

  setNewConfigItem({
    name: "",
    description: "",
    system_type: "Web Application",
    environment: "Production",
    criticality: "Medium",
    department_id: "",
  });

  await loadData();
}

function getSystemName(systemId: number) {
  const system = systems.find((item) => item.id === systemId);

  return system?.name || `Configuration Item #${systemId}`;
}

function formatDateTime(value?: string | null) {
  if (!value) return "N/A";

  const date = new Date(value);

  return date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

async function createDependency() {
  if (
    !newDependency.source_system_id ||
    !newDependency.target_system_id
  ) {
    alert(
      "Please select both the dependent item and the required configuration item."
    );
    return;
  }

  if (
    newDependency.source_system_id === newDependency.target_system_id
  ) {
    alert("A configuration item cannot depend on itself.");
    return;
  }

  const response = await fetch(
    `${API_BASE_URL}/foundation/dependencies`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        source_system_id: Number(newDependency.source_system_id),
        target_system_id: Number(newDependency.target_system_id),
        dependency_type: newDependency.dependency_type,
        impact_level: newDependency.impact_level,
        description: newDependency.description.trim() || null,
      }),
    }
  );

  const data = await response.json();

  if (!response.ok) {
    alert(data.detail || "Error creating dependency relationship.");
    return;
  }

  setNewDependency({
    source_system_id: "",
    target_system_id: "",
    dependency_type: "Application Dependency",
    impact_level: "Medium",
    description: "",
  });

  await loadData();

  alert("Dependency relationship registered successfully.");
}

async function createHistoricalIncident() {
  if (!newIncident.system_id) {
    alert("Please select a configuration item.");
    return;
  }

  if (!newIncident.title.trim()) {
    alert("Please enter the incident title.");
    return;
  }

  if (
    newIncident.occurred_at &&
    newIncident.resolved_at &&
    new Date(newIncident.resolved_at) <
      new Date(newIncident.occurred_at)
  ) {
    alert("Resolved date cannot be earlier than incident date.");
    return;
  }

  const response = await fetch(
    `${API_BASE_URL}/foundation/incidents`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        system_id: Number(newIncident.system_id),
        title: newIncident.title.trim(),
        description: newIncident.description.trim() || null,
        severity: newIncident.severity,
        status: newIncident.status,
        occurred_at: newIncident.occurred_at || null,
        resolved_at: newIncident.resolved_at || null,
      }),
    }
  );

  const data = await response.json();

  if (!response.ok) {
    alert(data.detail || "Error registering historical incident.");
    return;
  }

  setNewIncident({
    system_id: "",
    title: "",
    description: "",
    severity: "Medium",
    status: "Resolved",
    occurred_at: "",
    resolved_at: "",
  });

  await loadData();

  alert("Historical incident registered successfully.");
}
async function createRiskRule() {
  if (!newRiskRule.name.trim()) {
    alert("Please enter the risk rule name.");
    return;
  }

  if (Number(newRiskRule.score) < 0) {
    alert("Risk score cannot be negative.");
    return;
  }

  const response = await fetch(
    `${API_BASE_URL}/foundation/risk-rules`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: newRiskRule.name.trim(),
        condition_type: newRiskRule.condition_type,
        condition_value: newRiskRule.condition_value,
        score: Number(newRiskRule.score),
        description: newRiskRule.description.trim() || null,
        is_active: newRiskRule.is_active,
      }),
    }
  );

  const data = await response.json();

  if (!response.ok) {
    alert(data.detail || "Error creating risk rule.");
    return;
  }

  setNewRiskRule({
    name: "",
    condition_type: "change_type",
    condition_value: "database",
    score: 10,
    description: "",
    is_active: "active",
  });

  await loadData();

  alert("Risk rule registered successfully.");
}

async function toggleRiskRuleStatus(rule: RiskRule) {
  const nextStatus =
    rule.is_active === "active" ? "inactive" : "active";

  const response = await fetch(
    `${API_BASE_URL}/foundation/risk-rules/${rule.id}`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        is_active: nextStatus,
      }),
    }
  );

  const data = await response.json();

  if (!response.ok) {
    alert(data.detail || "Error updating risk rule.");
    return;
  }

  await loadData();
}

  function renderDashboard() {
    return (
      <>
        <header className="app-header">
          <div>
            <h1>ChangeFlow Governance</h1>
            <p>
              Enterprise IT Change Governance platform for impact assessment,
              authorization workflow, and audit-ready change records.
            </p>
          </div>

          <div className="actions">
            <button className="secondary-button" onClick={() => setView("foundation")}>
              Admin Console
            </button>
            
            <button className="primary-button" onClick={() => setView("new")}>
              New Change Request
            </button>
          </div>
        </header>

        <section className="stats-grid">
          <div className="stat-card">
            <span>Total Changes</span>
            <strong>{dashboardOverview?.total_changes ?? 0}</strong>
          </div>

          <div className="stat-card">
            <span>Pending Approval</span>
            <strong>{dashboardOverview?.pending_approval ?? 0}</strong>
          </div>

          <div className="stat-card">
            <span>Approved</span>
            <strong>{dashboardOverview?.approved ?? 0}</strong>
          </div>

          <div className="stat-card">
            <span>Rejected</span>
            <strong>{dashboardOverview?.rejected ?? 0}</strong>
          </div>

          <div className="stat-card">
            <span>Avg Impact Score</span>
            <strong>{dashboardOverview?.average_impact_score ?? 0}%</strong>
          </div>
        </section>

        <section className="panel">
          <h2>Service & Configuration Data Foundation</h2>
          <p>
            This product uses foundation data such as departments, IT systems,
            dependencies, previous incidents, and risk rules to assess change
            impact.
          </p>

          <div className="mini-grid">
            <div>Departments: {foundationOverview?.departments ?? 0}</div>
            <div>Systems: {foundationOverview?.systems ?? 0}</div>
            <div>Dependencies: {foundationOverview?.dependencies ?? 0}</div>
            <div>Incidents: {foundationOverview?.incidents ?? 0}</div>
            <div>Risk Rules: {foundationOverview?.risk_rules ?? 0}</div>
          </div>
        </section>

        <section className="panel">
          <h2>Change Records</h2>

          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Change Title</th>
                <th>Type</th>
                <th>Status</th>
                <th>Risk</th>
                <th>Impact</th>
                <th>Authorization Path</th>
                <th>Action</th>
              </tr>
            </thead>

            <tbody>
              {changes.map((change) => (
                <tr key={change.id}>
                  <td>{change.id}</td>
                  <td>{change.title}</td>
                  <td>{change.change_type}</td>
                  <td>
                    <span className="status-badge">{change.status}</span>
                  </td>
                  <td>
                    <span
                      className={`risk-badge ${getRiskClass(
                        change.latest_assessment?.risk_level
                      )}`}
                    >
                      {change.latest_assessment?.risk_level ?? "N/A"}
                    </span>
                  </td>
                  <td>{change.latest_assessment?.impact_score ?? 0}%</td>
                  <td>
                    {getDecisionLabel(change.latest_assessment?.decision_recommendation)}
                  </td>
                  <td>
                    <button
                      className="table-button"
                      onClick={() => openChangeDetails(change.id)}
                    >
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </>
    );
  }

  function renderNewChange() {
    return (
      <section className="panel form-panel">
        <div className="section-header">
          <div>
            <h2>Register New Change Request</h2>
            <p>
              Select affected configuration items from the service foundation.
              The assessment will evaluate criticality, dependencies, historical incidents,
              risk rules, and required authorization path.
            </p>
          </div>

          <button className="secondary-button" onClick={() => setView("dashboard")}>
            Back
          </button>
        </div>

        <label>Title</label>
        <input
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          placeholder="Oracle Database Upgrade"
        />

        <label>Description</label>
        <textarea
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          placeholder="Describe the technical change..."
        />

        <div className="form-grid">
          <div>
            <label>Change Type</label>
            <select
              value={form.change_type}
              onChange={(e) => setForm({ ...form, change_type: e.target.value })}
            >
              <option value="database">database</option>
              <option value="security">security</option>
              <option value="network">network</option>
              <option value="application">application</option>
              <option value="documentation">documentation</option>
            </select>
          </div>

          <div>
            <label>Change Mode</label>
            <select
              value={form.change_mode}
              onChange={(e) => setForm({ ...form, change_mode: e.target.value })}
            >
              <option value="Standard">Standard</option>
              <option value="Normal">Normal</option>
              <option value="Emergency">Emergency</option>
            </select>
          </div>

          <div>
            <label>Priority</label>
            <select
              value={form.priority}
              onChange={(e) => setForm({ ...form, priority: e.target.value })}
            >
              <option value="Low">Low</option>
              <option value="Medium">Medium</option>
              <option value="High">High</option>
              <option value="Critical">Critical</option>
            </select>
          </div>
        </div>


        <div className="field-header">
          <label>Directly Affected Configuration Items</label>
          <div className="selection-actions">
            <span>{form.affected_system_ids.length} selected</span>
            {form.affected_system_ids.length > 0 && (
              <button
              type="button"
              className="clear-selection-button"
              onClick={() => setForm({ ...form, affected_system_ids: [] })}
            >
              Clear Selection
            </button>
            )}
        </div>
        </div>
        <p className="field-help-text">
          Select only the configuration items directly changed by this request.
          Downstream service impact will be detected automatically from dependency data.
        </p>

        <input
        className="system-search"
        value={systemSearch}
        onChange={(e) => setSystemSearch(e.target.value)}
        placeholder="Search configuration items by name, type, criticality..."
        />
        
        <div className="system-card-grid">
          {filteredSystems.map((system) => {
            const isSelected = form.affected_system_ids.includes(system.id);
            
            return (
            <button
            type="button"
            key={system.id}
            className={`system-card-option ${isSelected ? "selected" : ""}`}
            onClick={() => toggleAffectedSystem(system.id)}
          >
            <div className="system-card-top">
              <strong>{system.name}</strong>
              <span className={`criticality-pill ${system.criticality.toLowerCase()}`}>
            {system.criticality}
          </span>
        </div>

        <p>
          {system.system_type || "Configuration Item"} • {system.environment}
        </p>

        <span className="select-indicator">
          {isSelected ? "Selected" : "Select"}
        </span>
      </button>
    );
  })}
</div>

        <div className="form-grid">
          <div>
            <label>Expected Downtime Minutes</label>
            <input
              type="number"
              value={form.expected_downtime_minutes}
              onChange={(e) =>
                setForm({
                  ...form,
                  expected_downtime_minutes: Number(e.target.value),
                })
              }
            />
          </div>

          <div>
            <label>Rollback Complexity</label>
            <select
              value={form.rollback_complexity}
              onChange={(e) =>
                setForm({ ...form, rollback_complexity: e.target.value })
              }
            >
              <option value="Low">Low</option>
              <option value="Medium">Medium</option>
              <option value="High">High</option>
            </select>
          </div>

          <div>
            <label>Security Sensitivity</label>
            <select
              value={form.security_sensitivity}
              onChange={(e) =>
                setForm({ ...form, security_sensitivity: e.target.value })
              }
            >
              <option value="Low">Low</option>
              <option value="Medium">Medium</option>
              <option value="High">High</option>
            </select>
          </div>
        </div>

        <label>Business Justification</label>
        <textarea
          value={form.business_justification}
          onChange={(e) =>
            setForm({ ...form, business_justification: e.target.value })
          }
          placeholder="Why is this change required?"
        />

        <div className="form-grid">
          <div>
            <label>Planned Start</label>
            <input
              value={form.planned_start}
              onChange={(e) => setForm({ ...form, planned_start: e.target.value })}
              placeholder="2026-07-20 22:00"
            />
          </div>

          <div>
            <label>Planned End</label>
            <input
              value={form.planned_end}
              onChange={(e) => setForm({ ...form, planned_end: e.target.value })}
              placeholder="2026-07-21 01:00"
            />
          </div>
        </div>

        <button className="primary-button" onClick={createManagedChange}>
          {loading ? "Creating..." : "Register & Assess"}
        </button>
      </section>
    );
  }

  function renderFoundationManagement() {
  return (
    <section className="panel form-panel">
      <div className="section-header">
        <div>
          <h2>Admin Console</h2>
          <p>
            Administrator-only area for maintaining service and configuration data used by
            the change assessment engine. Requesters do not manage departments, systems,
            dependencies, or risk rules.
          </p>
        </div>
        <button className="secondary-button" onClick={() => setView("dashboard")}>
          Back
        </button>
      </div>
      <section className="admin-note">
        <strong>Governance Note</strong>
        <p>
          Business units, services, configuration items, dependencies, historical
          incidents, and risk rules are foundation data. They should be maintained by
          a System Administrator, CMDB Manager, or through enterprise integrations.
          Change requesters only select the directly affected configuration items when
          submitting a change request.
        </p>
      </section>
      <section className="panel inner-panel">
        <h3>Configuration Item Registry</h3>
        <p>
          Register systems, databases, applications, infrastructure components, or
          services as controlled configuration items. These items become available to
          requesters when submitting change requests.
        </p>

        <label>Configuration Item Name</label>
        <input
          value={newConfigItem.name}
          onChange={(e) =>
            setNewConfigItem({ ...newConfigItem, name: e.target.value })
        }
        placeholder="Legal Case Management System"
      />

      <label>Description</label>
      <textarea
      value={newConfigItem.description}
      onChange={(e) =>
        setNewConfigItem({ ...newConfigItem, description: e.target.value })
      }
      placeholder="System used to manage legal and compliance cases."
    />

    <div className="form-grid">
      <div>
        <label>Business Unit</label>
        <select
          value={newConfigItem.department_id}
          onChange={(e) =>
            setNewConfigItem({
              ...newConfigItem,
              department_id: e.target.value,
            })
          }
        >
          <option value="">Unassigned</option>
          {departments.map((department) => (
            <option key={department.id} value={department.id}>
              {department.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label>Configuration Item Type</label>
        <select
        value={newConfigItem.system_type}
        onChange={(e) =>
          setNewConfigItem({
            ...newConfigItem,
            system_type: e.target.value,
          })
        }
      >
        <option value="Web Application">Web Application</option>
        <option value="Database">Database</option>
        <option value="ERP">ERP</option>
        <option value="Network Security">Network Security</option>
        <option value="Integration">Integration</option>
        <option value="Identity Service">Identity Service</option>
        <option value="Monitoring">Monitoring</option>
        <option value="Backup">Backup</option>
        <option value="Infrastructure">Infrastructure</option>
      </select>
    </div>

    <div>
      <label>Criticality</label>
      <select
        value={newConfigItem.criticality}
        onChange={(e) =>
          setNewConfigItem({
            ...newConfigItem,
            criticality: e.target.value,
          })
        }
      >
        <option value="Low">Low</option>
        <option value="Medium">Medium</option>
        <option value="High">High</option>
        <option value="Critical">Critical</option>
      </select>
    </div>
  </div>

  <label>Environment</label>
  <select
    value={newConfigItem.environment}
    onChange={(e) =>
      setNewConfigItem({
        ...newConfigItem,
        environment: e.target.value,
      })
    }
  >
    <option value="Production">Production</option>
    <option value="Staging">Staging</option>
    <option value="Development">Development</option>
    <option value="Testing">Testing</option>
  </select>

  <button className="primary-button" onClick={createConfigurationItem}>
    Register Configuration Item
  </button>
</section>
<section className="panel inner-panel">
  <h3>Dependency Registry</h3>

  <p>
    Define relationships between configuration items. These relationships
    allow the assessment engine to detect downstream service impact
    automatically.
  </p>

  <div className="form-grid">
    <div>
      <label>Dependent Configuration Item</label>

      <select
        value={newDependency.source_system_id}
        onChange={(e) =>
          setNewDependency({
            ...newDependency,
            source_system_id: e.target.value,
          })
        }
      >
        <option value="">Select dependent item</option>

        {systems.map((system) => (
          <option key={system.id} value={system.id}>
            {system.name}
          </option>
        ))}
      </select>
    </div>

    <div>
      <label>Depends On</label>

      <select
        value={newDependency.target_system_id}
        onChange={(e) =>
          setNewDependency({
            ...newDependency,
            target_system_id: e.target.value,
          })
        }
      >
        <option value="">Select required item</option>

        {systems.map((system) => (
          <option key={system.id} value={system.id}>
            {system.name}
          </option>
        ))}
      </select>
    </div>

    <div>
      <label>Impact Level</label>

      <select
        value={newDependency.impact_level}
        onChange={(e) =>
          setNewDependency({
            ...newDependency,
            impact_level: e.target.value,
          })
        }
      >
        <option value="Low">Low</option>
        <option value="Medium">Medium</option>
        <option value="High">High</option>
        <option value="Critical">Critical</option>
      </select>
    </div>
  </div>

  <label>Dependency Type</label>

  <select
    value={newDependency.dependency_type}
    onChange={(e) =>
      setNewDependency({
        ...newDependency,
        dependency_type: e.target.value,
      })
    }
  >
    <option value="Application Dependency">
      Application Dependency
    </option>

    <option value="Database Dependency">
      Database Dependency
    </option>

    <option value="Authentication Dependency">
      Authentication Dependency
    </option>

    <option value="Integration Dependency">
      Integration Dependency
    </option>

    <option value="Network Dependency">
      Network Dependency
    </option>

    <option value="Infrastructure Dependency">
      Infrastructure Dependency
    </option>

    <option value="Data Dependency">
      Data Dependency
    </option>
  </select>

  <label>Description</label>

  <textarea
    value={newDependency.description}
    onChange={(e) =>
      setNewDependency({
        ...newDependency,
        description: e.target.value,
      })
    }
    placeholder="Describe why the dependent item requires the target item."
  />

  {newDependency.source_system_id &&
    newDependency.target_system_id && (
      <div className="dependency-preview">
        <strong>
          {getSystemName(Number(newDependency.source_system_id))}
        </strong>

        <span> depends on </span>

        <strong>
          {getSystemName(Number(newDependency.target_system_id))}
        </strong>
      </div>
    )}

  <button
    className="primary-button"
    onClick={createDependency}
  >
    Register Dependency
  </button>
</section>

<section className="panel inner-panel">
  <h3>Registered Dependencies</h3>

  {dependencies.length === 0 ? (
    <p>No dependency relationships have been registered yet.</p>
  ) : (
    <table>
      <thead>
        <tr>
          <th>ID</th>
          <th>Dependent Item</th>
          <th>Relationship Type</th>
          <th>Required Item</th>
          <th>Impact</th>
        </tr>
      </thead>

      <tbody>
        {dependencies.map((dependency) => (
          <tr key={dependency.id}>
            <td>{dependency.id}</td>

            <td>
              {getSystemName(dependency.source_system_id)}
            </td>

            <td>{dependency.dependency_type}</td>

            <td>
              {getSystemName(dependency.target_system_id)}
            </td>

            <td>
              <span
                className={`risk-badge ${dependency.impact_level.toLowerCase()}`}
              >
                {dependency.impact_level}
              </span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )}
</section>
<section className="panel inner-panel">
  <h3>Historical Incident Registry</h3>

  <p>
    Register previous operational incidents and associate them with
    configuration items. Historical incidents are considered during
    change risk and impact assessment.
  </p>

  <label>Configuration Item</label>

  <select
    value={newIncident.system_id}
    onChange={(e) =>
      setNewIncident({
        ...newIncident,
        system_id: e.target.value,
      })
    }
  >
    <option value="">Select configuration item</option>

    {systems.map((system) => (
      <option key={system.id} value={system.id}>
        {system.name}
      </option>
    ))}
  </select>

  <label>Incident Title</label>

  <input
    value={newIncident.title}
    onChange={(e) =>
      setNewIncident({
        ...newIncident,
        title: e.target.value,
      })
    }
    placeholder="Database performance degradation"
  />

  <label>Description</label>

  <textarea
    value={newIncident.description}
    onChange={(e) =>
      setNewIncident({
        ...newIncident,
        description: e.target.value,
      })
    }
    placeholder="Describe the operational impact and symptoms of the incident."
  />

  <div className="form-grid">
    <div>
      <label>Severity</label>

      <select
        value={newIncident.severity}
        onChange={(e) =>
          setNewIncident({
            ...newIncident,
            severity: e.target.value,
          })
        }
      >
        <option value="Low">Low</option>
        <option value="Medium">Medium</option>
        <option value="High">High</option>
        <option value="Critical">Critical</option>
      </select>
    </div>

    <div>
      <label>Status</label>

      <select
        value={newIncident.status}
        onChange={(e) =>
          setNewIncident({
            ...newIncident,
            status: e.target.value,
          })
        }
      >
        <option value="Open">Open</option>
        <option value="Investigating">Investigating</option>
        <option value="Resolved">Resolved</option>
        <option value="Closed">Closed</option>
      </select>
    </div>
  </div>

  <div className="form-grid">
    <div>
      <label>Occurred At</label>

      <input
        type="datetime-local"
        value={newIncident.occurred_at}
        onChange={(e) =>
          setNewIncident({
            ...newIncident,
            occurred_at: e.target.value,
          })
        }
      />
    </div>

    <div>
      <label>Resolved At</label>

      <input
        type="datetime-local"
        value={newIncident.resolved_at}
        onChange={(e) =>
          setNewIncident({
            ...newIncident,
            resolved_at: e.target.value,
          })
        }
      />
    </div>
  </div>

  <button
    className="primary-button"
    onClick={createHistoricalIncident}
  >
    Register Historical Incident
  </button>
</section>
<section className="panel inner-panel">
  <h3>Registered Historical Incidents</h3>

  {incidents.length === 0 ? (
    <p>No historical incidents have been registered yet.</p>
  ) : (
    <table>
      <thead>
        <tr>
          <th>ID</th>
          <th>Configuration Item</th>
          <th>Incident</th>
          <th>Severity</th>
          <th>Status</th>
          <th>Occurred At</th>
        </tr>
      </thead>

      <tbody>
        {incidents.map((incident) => (
          <tr key={incident.id}>
            <td>{incident.id}</td>

            <td>{getSystemName(incident.system_id)}</td>

            <td>
              <strong>{incident.title}</strong>
              <br />
              <span className="table-description">
                {incident.description || "No description"}
              </span>
            </td>

            <td>
              <span
                className={`risk-badge ${incident.severity.toLowerCase()}`}
              >
                {incident.severity}
              </span>
            </td>

            <td>
              <span className="status-badge">
                {incident.status}
              </span>
            </td>

            <td>{formatDateTime(incident.occurred_at)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )}
</section>
<section className="panel inner-panel">
  <h3>Risk Rule Registry</h3>

  <p>
    Define governance rules used by the assessment engine to calculate
    risk exposure. Only active rules are applied during change assessment.
  </p>

  <label>Rule Name</label>

  <input
    value={newRiskRule.name}
    onChange={(e) =>
      setNewRiskRule({
        ...newRiskRule,
        name: e.target.value,
      })
    }
    placeholder="Critical Database Change Rule"
  />

  <div className="form-grid">
    <div>
      <label>Condition Type</label>

      <select
        value={newRiskRule.condition_type}
        onChange={(e) => {
          const conditionType = e.target.value;
          const firstValue =
            riskRuleValueOptions[conditionType][0];

          setNewRiskRule({
            ...newRiskRule,
            condition_type: conditionType,
            condition_value: firstValue,
          });
        }}
      >
        <option value="change_type">
          Change Type
        </option>

        <option value="change_mode">
          Change Mode
        </option>

        <option value="system_criticality">
          Configuration Item Criticality
        </option>

        <option value="dependency_impact">
          Dependency Impact
        </option>

        <option value="previous_incident">
          Historical Incident Severity
        </option>

        <option value="expected_downtime">
          Expected Downtime
        </option>

        <option value="rollback_complexity">
          Backout Complexity
        </option>

        <option value="security_sensitivity">
          Security Sensitivity
        </option>
      </select>
    </div>

    <div>
      <label>Condition Value</label>

      <select
        value={newRiskRule.condition_value}
        onChange={(e) =>
          setNewRiskRule({
            ...newRiskRule,
            condition_value: e.target.value,
          })
        }
      >
        {riskRuleValueOptions[
          newRiskRule.condition_type
        ].map((value) => (
          <option key={value} value={value}>
            {value}
          </option>
        ))}
      </select>
    </div>

    <div>
      <label>Risk Score</label>

      <input
        type="number"
        min="0"
        value={newRiskRule.score}
        onChange={(e) =>
          setNewRiskRule({
            ...newRiskRule,
            score: Number(e.target.value),
          })
        }
      />
    </div>
  </div>

  <label>Description</label>

  <textarea
    value={newRiskRule.description}
    onChange={(e) =>
      setNewRiskRule({
        ...newRiskRule,
        description: e.target.value,
      })
    }
    placeholder="Explain when this rule is applied and why it contributes to risk exposure."
  />

  <label>Status</label>

  <select
    value={newRiskRule.is_active}
    onChange={(e) =>
      setNewRiskRule({
        ...newRiskRule,
        is_active: e.target.value,
      })
    }
  >
    <option value="active">Active</option>
    <option value="inactive">Inactive</option>
  </select>

  <button
    className="primary-button"
    onClick={createRiskRule}
  >
    Register Risk Rule
  </button>
</section>
<section className="panel inner-panel">
  <h3>Registered Risk Rules</h3>

  {riskRules.length === 0 ? (
    <p>No risk rules have been registered yet.</p>
  ) : (
    <table>
      <thead>
        <tr>
          <th>ID</th>
          <th>Rule</th>
          <th>Condition</th>
          <th>Value</th>
          <th>Score</th>
          <th>Status</th>
          <th>Action</th>
        </tr>
      </thead>

      <tbody>
        {riskRules.map((rule) => (
          <tr key={rule.id}>
            <td>{rule.id}</td>

            <td>
              <strong>{rule.name}</strong>
              <br />

              <span className="table-description">
                {rule.description || "No description"}
              </span>
            </td>

            <td>{rule.condition_type}</td>

            <td>{rule.condition_value}</td>

            <td>
              <strong>+{rule.score}</strong>
            </td>

            <td>
              <span
                className={`rule-status ${rule.is_active}`}
              >
                {rule.is_active}
              </span>
            </td>

            <td>
              <button
                className="table-button"
                onClick={() => toggleRiskRuleStatus(rule)}
              >
                {rule.is_active === "active"
                  ? "Deactivate"
                  : "Activate"}
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )}
</section>
<section className="panel inner-panel">
  <h3>Registered Configuration Items</h3>

  <table>
    <thead>
      <tr>
        <th>ID</th>
        <th>Configuration Item</th>
        <th>Type</th>
        <th>Criticality</th>
        <th>Environment</th>
      </tr>
    </thead>

    <tbody>
      {systems.map((system) => (
        <tr key={system.id}>
          <td>{system.id}</td>
          <td>{system.name}</td>
          <td>{system.system_type || "N/A"}</td>
          <td>
            <span className={`risk-badge ${system.criticality.toLowerCase()}`}>
              {system.criticality}
            </span>
          </td>
          <td>{system.environment}</td>
        </tr>
      ))}
    </tbody>
  </table>
</section>

      <section className="panel inner-panel">
        <h3>Registered Business Units</h3>

        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Business Unit</th>
              <th>Description</th>
            </tr>
          </thead>

          <tbody>
            {departments.map((department) => (
              <tr key={department.id}>
                <td>{department.id}</td>
                <td>{department.name}</td>
                <td>{department.description || "N/A"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </section>
  );
}

  function renderDetails() {
    if (!selectedChange) return null;

    const assessment = selectedChange.latest_assessment;

    return (
      <section className="panel">
        <div className="section-header">
          <div>
            <h2>{selectedChange.title}</h2>
            <p>{selectedChange.description}</p>
          </div>

          <div className="actions">
            <button className="secondary-button" onClick={() => setView("dashboard")}>
              Back
            </button>
            <button className="secondary-button" onClick={() => window.print()}>
              Print / Export PDF
            </button>
          </div>
        </div>

        <section className="stats-grid">
          <div className="stat-card">
            <span>Current State</span>
            <strong>{selectedChange.status}</strong>
            <p className="metric-description">
              Current lifecycle state of this change record.
            </p>
          </div>
          <div className="stat-card">
            <span>Risk Rating</span>
            <strong className={`risk-text ${getRiskClass(assessment?.risk_level)}`}>
              {assessment?.risk_level ?? "N/A"}
            </strong>
            <p className="metric-description">
              Risk rating calculated from criticality, dependencies, incidents, and change scope.
            </p>
          </div>

          <div className="stat-card">
            <span>Impact Exposure</span>
            <strong>{assessment?.impact_score ?? 0}%</strong>
            <p className="metric-description">
              Estimated exposure level across services, systems, and business units.
            </p>
          </div>
          
          <div className="stat-card">
            <span>Authorization Recommendation</span>
            <strong>{getDecisionLabel(assessment?.decision_recommendation)}</strong>
            <p className="metric-description">
              Recommended authorization path before implementation.
            </p>
          </div>
        </section>

        <section className="panel inner-panel">
          <h3>Assessment Rationale</h3>
          <p>{assessment?.ai_explanation}</p>
        </section>

        <section className="two-column">
          <div className="panel inner-panel">
            <h3>Directly Affected Configuration Items</h3>
            <ul>
              {assessment?.directly_affected_systems.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>

          <div className="panel inner-panel">
            <h3>Downstream Service Impact</h3>
            <ul>
              {assessment?.indirectly_affected_systems.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        </section>

        <section className="two-column">
          <div className="panel inner-panel">
            <h3>Affected Business Units</h3>
            <ul>
              {assessment?.affected_departments.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>

          <div className="panel inner-panel">
            <h3>Historical Incidents</h3>
            <ul>
              {assessment?.previous_incidents.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        </section>

        <section className="panel inner-panel">
          <h3>Risk Drivers</h3>
          <ul>
            {assessment?.risk_factors.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>

        <section className="two-column">
          <div className="panel inner-panel">
            <h3>Control Recommendations</h3>
            <ul>
              {assessment?.recommendations.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>

          <div className="panel inner-panel">
            <h3>Backout Plan</h3>
            <ol>
              {assessment?.rollback_plan.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ol>
          </div>
        </section>

        <section className="panel inner-panel">
          <h3>Validation Checklist</h3>
          <ul>
            {assessment?.testing_checklist.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>

        <section className="panel inner-panel">
          <h3>Authorization Decision</h3>
          {selectedChange.status === "Pending Approval" ||
          selectedChange.status === "Needs More Information" ? (
          <div className="actions">
            <button
            className="approve-button"onClick={() => submitApproval("Approved")}>Approve
            </button>
            <button
            className="warning-button"onClick={() => submitApproval("Needs More Information")}>
              Needs More Information
              </button>
              <button
              className="delete-button"onClick={() => submitApproval("Rejected")}>
                Reject
              </button>
          </div>
  ) : (
    <p className="readonly-note">
      This change is currently <strong>{selectedChange.status}</strong>. Authorization
      actions are locked because a final decision has already been recorded.
    </p>
  )}
</section>

<section className="two-column">
  <div className="panel inner-panel">
    <h3>Authorization Records</h3>

    {approvals.length === 0 ? (
      <p>No authorization decisions recorded yet.</p>
    ) : (
      <ul>
        {approvals.map((approval) => (
          <li key={approval.approval_id}>
            <strong>{approval.decision}</strong> - {approval.approval_level}
            <br />
            {approval.comments}
          </li>
        ))}
      </ul>
    )}
  </div>

  <div className="panel inner-panel">
    <h3>Change Timeline</h3>

    {statusHistory.length === 0 ? (
      <p>No status history available.</p>
    ) : (
      <ul>
        {statusHistory.map((item, index) => (
          <li key={index}>
            <strong>{item.old_status || "Created"}</strong> →{" "}
            <strong>{item.new_status}</strong>
            <br />
            {item.comment}
          </li>
        ))}
      </ul>
    )}
  </div>
</section>

<section className="panel inner-panel">
  <h3>Audit Trail</h3>

  {auditLogs.length === 0 ? (
    <p>No audit logs available.</p>
  ) : (
    <ul>
      {auditLogs.map((log, index) => (
        <li key={index}>
          <strong>{log.action}</strong>
          <br />
          {log.details}
        </li>
      ))}
    </ul>
  )}
</section>
      </section>
    );
  }

  return (
    <main className="page">
      {view === "dashboard" && renderDashboard()}
      {view === "new" && renderNewChange()}
      {view === "details" && renderDetails()}
      {view === "foundation" && renderFoundationManagement()}
    </main>
  );
}

export default App;
