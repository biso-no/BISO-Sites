"use client";

import type {
  RecruitmentCustomQuestion,
  RecruitmentCustomQuestionType,
  RecruitmentScreeningCriterion,
} from "@repo/shared/types/recruitment";
import { Plus, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { updateRecruitmentForm } from "../../../_actions/recruitment-workspace";
import { useRecruitment } from "../recruitment-context";
import { cx } from "../view-model";

const QUESTION_TYPES: RecruitmentCustomQuestionType[] = [
  "text",
  "long_text",
  "select",
  "multi_select",
  "boolean",
  "number",
];

const TYPE_LABEL: Record<RecruitmentCustomQuestionType, string> = {
  boolean: "Yes / No",
  long_text: "Long text",
  multi_select: "Multi-select",
  number: "Number",
  select: "Select",
  text: "Short text",
};

function makeId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 8)}`;
}

const hasOptions = (type: RecruitmentCustomQuestionType) =>
  type === "select" || type === "multi_select";

export function FormRubricTab() {
  const { job, jobId } = useRecruitment();
  const [questions, setQuestions] = useState<RecruitmentCustomQuestion[]>(
    job.customQuestions
  );
  const [criteria, setCriteria] = useState<RecruitmentScreeningCriterion[]>(
    job.screeningRubric.criteria
  );
  const [saving, startSave] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totalWeight = criteria.reduce(
    (sum, criterion) => sum + (criterion.weight || 0),
    0
  );

  const updateQuestion = (
    id: string,
    patch: Partial<RecruitmentCustomQuestion>
  ) => {
    setQuestions((prev) =>
      prev.map((question) =>
        question.id === id ? { ...question, ...patch } : question
      )
    );
  };

  const addQuestion = () => {
    setQuestions((prev) => [
      ...prev,
      {
        id: makeId("q"),
        label: "New question",
        options: [],
        required: false,
        type: "text",
      },
    ]);
  };

  const save = () => {
    setError(null);
    setSaved(false);
    startSave(async () => {
      const result = await updateRecruitmentForm(jobId, {
        customQuestions: questions,
        screeningRubric: {
          ...job.screeningRubric,
          criteria,
        },
      });
      if (result.error) {
        setError(result.error);
      } else {
        setSaved(true);
        setTimeout(() => setSaved(false), 2200);
      }
    });
  };

  return (
    <div className="form-tab rcr-pad">
      <div className="ft-main">
        <div className="ft-section">
          <div className="ft-section-head">
            <h3>Application questions</h3>
            <button className="btn-ghost" onClick={addQuestion} type="button">
              <Plus size={13} /> Add question
            </button>
          </div>
          <div className="ft-questions">
            {questions.length === 0 ? (
              <p className="ft-empty">
                No custom questions. Applicants only submit the standard fields.
              </p>
            ) : null}
            {questions.map((question, index) => (
              <div className="ft-q" key={question.id}>
                <span className="ft-q-num">Q{index + 1}</span>
                <div className="ft-q-body">
                  <input
                    className="ft-q-label"
                    onChange={(event) =>
                      updateQuestion(question.id, { label: event.target.value })
                    }
                    value={question.label}
                  />
                  <div className="ft-q-controls">
                    <select
                      onChange={(event) =>
                        updateQuestion(question.id, {
                          type: event.target
                            .value as RecruitmentCustomQuestionType,
                        })
                      }
                      value={question.type}
                    >
                      {QUESTION_TYPES.map((type) => (
                        <option key={type} value={type}>
                          {TYPE_LABEL[type]}
                        </option>
                      ))}
                    </select>
                    <label className="ft-q-req">
                      <input
                        checked={question.required}
                        onChange={(event) =>
                          updateQuestion(question.id, {
                            required: event.target.checked,
                          })
                        }
                        type="checkbox"
                      />
                      Required
                    </label>
                  </div>
                  {hasOptions(question.type) ? (
                    <input
                      className="ft-q-options"
                      onChange={(event) =>
                        updateQuestion(question.id, {
                          options: event.target.value
                            .split(",")
                            .map((value) => value.trim())
                            .filter(Boolean),
                        })
                      }
                      placeholder="Comma-separated options"
                      value={(question.options ?? []).join(", ")}
                    />
                  ) : null}
                </div>
                <button
                  className="ft-q-del"
                  onClick={() =>
                    setQuestions((prev) =>
                      prev.filter((entry) => entry.id !== question.id)
                    )
                  }
                  title="Remove"
                  type="button"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="ft-section">
          <div className="ft-section-head">
            <h3>Screening rubric</h3>
            <span className={cx("ft-weight", totalWeight === 100 && "ok")}>
              Total {totalWeight}%
            </span>
          </div>
          <div className="ft-rubric">
            {criteria.map((criterion, index) => (
              <div className="ft-crit" key={criterion.key}>
                <input
                  className="ft-crit-label"
                  onChange={(event) =>
                    setCriteria((prev) =>
                      prev.map((entry, entryIndex) =>
                        entryIndex === index
                          ? { ...entry, label: event.target.value }
                          : entry
                      )
                    )
                  }
                  value={criterion.label}
                />
                <input
                  className="ft-crit-weight"
                  max={10}
                  min={0}
                  onChange={(event) =>
                    setCriteria((prev) =>
                      prev.map((entry, entryIndex) =>
                        entryIndex === index
                          ? { ...entry, weight: Number(event.target.value) }
                          : entry
                      )
                    )
                  }
                  type="number"
                  value={criterion.weight}
                />
                <button
                  className="ft-q-del"
                  onClick={() =>
                    setCriteria((prev) =>
                      prev.filter((_, entryIndex) => entryIndex !== index)
                    )
                  }
                  title="Remove"
                  type="button"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
            <button
              className="btn-ghost"
              onClick={() =>
                setCriteria((prev) => [
                  ...prev,
                  {
                    description: null,
                    key: makeId("r"),
                    label: "New criterion",
                    weight: 1,
                  },
                ])
              }
              type="button"
            >
              <Plus size={13} /> Add criterion
            </button>
          </div>
        </div>

        <div className="ft-save-bar">
          {error ? <span className="ft-error">{error}</span> : null}
          {saved ? <span className="ft-saved">Saved</span> : null}
          <button
            className="btn-dark"
            disabled={saving}
            onClick={save}
            type="button"
          >
            {saving ? "Saving…" : "Save form & rubric"}
          </button>
        </div>
      </div>

      <aside className="ft-preview">
        <h4>Applicant preview</h4>
        <div className="ft-preview-card">
          <p className="ft-preview-title">Apply: {job.titleEn}</p>
          <p className="ft-preview-meta">
            {[job.term, job.departmentName].filter(Boolean).join(" · ")}
          </p>
          {questions.slice(0, 4).map((question) => (
            <div className="ft-preview-field" key={question.id}>
              <span className="ft-preview-q">
                {question.label}
                {question.required ? (
                  <span className="ft-req-star"> *</span>
                ) : null}
              </span>
              <PreviewField question={question} />
            </div>
          ))}
          {questions.length > 4 ? (
            <p className="ft-preview-more">
              + {questions.length - 4} more questions
            </p>
          ) : null}
        </div>
      </aside>
    </div>
  );
}

function placeholderFor(type: RecruitmentCustomQuestionType): string {
  if (type === "long_text") {
    return "Long answer…";
  }
  if (type === "number") {
    return "0";
  }
  return "Short answer…";
}

function PreviewField({ question }: { question: RecruitmentCustomQuestion }) {
  if (question.type === "boolean") {
    return (
      <div className="ft-preview-pills">
        <span>Yes</span>
        <span>No</span>
      </div>
    );
  }
  if (hasOptions(question.type)) {
    return (
      <div className="ft-preview-pills">
        {(question.options ?? []).slice(0, 4).map((option) => (
          <span key={option}>{option}</span>
        ))}
      </div>
    );
  }
  return (
    <span className="ft-preview-input">{placeholderFor(question.type)}</span>
  );
}
