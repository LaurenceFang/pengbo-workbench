from __future__ import annotations

from typing import Iterable

from ..models import (
    DataQualityConfidence,
    DataQualityDimension,
    DataQualityLevel,
    DataQualityStatus,
    FreshnessState,
)


def _dimension(level: DataQualityLevel, label: str, detail: str, signals: Iterable[str] = ()) -> DataQualityDimension:
    return DataQualityDimension(level=level, label=label, detail=detail, signals=list(signals))


def _overall(*levels: DataQualityLevel) -> DataQualityLevel:
    if "blocked" in levels:
        return "blocked"
    if "limited" in levels:
        return "limited"
    if "partial" in levels:
        return "partial"
    if all(level == "complete" for level in levels):
        return "complete"
    return "unknown"


def quality_from_provider_state(
    *,
    provider: str,
    health: str,
    freshness_state: FreshnessState,
    configured: bool,
    requires_credentials: bool = False,
    stale: bool = False,
    missing_items: Iterable[str] = (),
    limitations: Iterable[str] = (),
    source_confidence: DataQualityConfidence = "public",
) -> DataQualityStatus:
    missing = [item for item in missing_items if item]
    notes = list(limitations)

    completeness_level: DataQualityLevel = "complete"
    if requires_credentials and not configured:
        completeness_level = "blocked"
        notes.append("Provider credentials are required before this source can produce live evidence.")
    elif health in {"unavailable", "unsupported", "error"}:
        completeness_level = "blocked" if not missing else "limited"
    elif missing:
        completeness_level = "partial"

    timeliness_level: DataQualityLevel = "unknown"
    if freshness_state == "fresh":
        timeliness_level = "complete"
    elif freshness_state == "cached":
        timeliness_level = "partial"
    elif freshness_state in {"stale", "refresh_failed"} or stale:
        timeliness_level = "limited"
    elif freshness_state in {"offline", "credential_required", "unavailable", "unsupported"}:
        timeliness_level = "blocked"

    confidence_level: DataQualityLevel = "complete"
    confidence = source_confidence
    if freshness_state in {"cached", "stale", "refresh_failed"}:
        confidence = "local_cache"
        confidence_level = "partial" if freshness_state == "cached" else "limited"
    if health == "unsupported":
        confidence = "unsupported"
        confidence_level = "blocked"
    if requires_credentials and not configured:
        confidence_level = "blocked"

    if missing:
        notes.append(f"Missing data: {', '.join(missing)}.")
    if freshness_state in {"stale", "refresh_failed", "offline"}:
        notes.append(f"Timeliness is {freshness_state}; refresh before relying on current market evidence.")

    return DataQualityStatus(
        overall=_overall(completeness_level, timeliness_level, confidence_level),
        completeness=_dimension(
            completeness_level,
            "Completeness",
            "Required evidence is available." if completeness_level == "complete" else "Some required evidence is missing or blocked.",
            missing,
        ),
        timeliness=_dimension(
            timeliness_level,
            "Timeliness",
            f"Freshness state is {freshness_state}.",
            [freshness_state],
        ),
        source_confidence=_dimension(
            confidence_level,
            "Source confidence",
            f"Evidence source confidence is {confidence}.",
            [provider, confidence],
        ),
        limitations=notes,
        notes=notes,
        machine_tags=sorted({provider, health, freshness_state, confidence, *missing}),
    )


def quality_from_missing_and_stale(
    *,
    provider: str,
    stale: bool,
    missing_items: Iterable[str] = (),
    limitations: Iterable[str] = (),
    simulated: bool = False,
    unavailable: bool = False,
) -> DataQualityStatus:
    missing = [item for item in missing_items if item]
    freshness: FreshnessState = "cached" if stale else "fresh"
    health = "unavailable" if unavailable else "ok"
    confidence: DataQualityConfidence = "simulated" if simulated else "provider"
    quality = quality_from_provider_state(
        provider=provider,
        health=health,
        freshness_state=freshness,
        configured=True,
        stale=stale,
        missing_items=missing,
        limitations=limitations,
        source_confidence=confidence,
    )
    if unavailable:
        quality.overall = "blocked"
        quality.completeness.level = "blocked"
        quality.completeness.detail = "Required provider evidence is unavailable."
        quality.timeliness.level = "blocked"
        quality.timeliness.detail = "Provider evidence is unavailable."
        quality.source_confidence.level = "blocked"
    if simulated:
        quality.source_confidence.level = "limited"
        quality.source_confidence.detail = "Evidence is simulated or locally replayed; do not treat it as live performance."
        quality.limitations.append("Simulated or replayed evidence cannot be used as a performance claim.")
        quality.machine_tags.append("simulated")
        quality.overall = _overall(quality.completeness.level, quality.timeliness.level, quality.source_confidence.level)
    return quality
