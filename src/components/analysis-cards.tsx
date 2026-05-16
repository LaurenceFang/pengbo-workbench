import type { AnalysisModuleResult } from "../lib/api";

function getToneClass(tone: "neutral" | "positive" | "caution"): string {
  if (tone === "positive") {
    return "tone-positive";
  }
  if (tone === "caution") {
    return "tone-caution";
  }
  return "tone-neutral";
}

export function AnalysisModuleList({
  modules,
}: {
  modules: AnalysisModuleResult[];
}) {
  if (modules.length === 0) {
    return <p className="panel-note">No structured analysis modules are attached to this brief yet.</p>;
  }

  return (
    <div className="analysis-module-list">
      {modules.map((module) => (
        <article
          aria-label={`research-analysis-card key=${module.key}`}
          className="analysis-card"
          key={module.key}
        >
          <div className="analysis-card-head">
            <div>
              <p className="eyebrow">Module</p>
              <strong>{module.title}</strong>
            </div>
            <div className="analysis-card-pills">
              <span className={`mini-pill ${module.stale ? "" : "accent"}`}>{module.stale ? "cached" : "live"}</span>
              <span className="mini-pill">{module.key}</span>
            </div>
          </div>
          <p className="research-copy">{module.summary}</p>
          {module.highlights.length > 0 ? (
            <div className="analysis-highlight-grid">
              {module.highlights.map((item) => (
                <div className="analysis-highlight" key={`${module.key}-${item.label}`}>
                  <span>{item.label}</span>
                  <strong className={getToneClass(item.tone)}>{item.value}</strong>
                </div>
              ))}
            </div>
          ) : null}
          <div className="analysis-section-list">
            {module.sections.map((section) => (
              <section className="analysis-section" key={`${module.key}-${section.title}`}>
                <strong>{section.title}</strong>
                {section.kind === "bullets" ? (
                  <ul className="analysis-bullet-list">
                    {section.items.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                ) : (
                  <p>{section.body}</p>
                )}
              </section>
            ))}
          </div>
          {module.sources.length > 0 ? (
            <div className="analysis-source-list">
              {module.sources.map((item) => (
                <span className="mini-pill" key={`${module.key}-${item.label}`}>
                  {item.label}
                  {item.detail ? `: ${item.detail}` : ""}
                </span>
              ))}
            </div>
          ) : null}
        </article>
      ))}
    </div>
  );
}
