from __future__ import annotations

from typing import Literal


ScreenerTuningLevel = Literal["low", "medium", "high"]

DEFAULT_VARIANT_KEY = "default"
TUNING_LEVELS: tuple[ScreenerTuningLevel, ...] = ("low", "medium", "high")

PRESET_TUNING_KEYS: dict[str, tuple[str, str, str]] = {
    "quality-equities": ("quality_floor", "trend_requirement", "size_bias"),
    "growth-rebound": ("rebound_strength", "pullback_window", "quality_guardrail"),
    "trend-crypto": ("momentum_bias", "liquidity_floor", "volatility_tolerance"),
    "majors-crypto": ("liquidity_bias", "trend_requirement", "exhaustion_guardrail"),
}

DEFAULT_TUNING_BY_PRESET: dict[str, dict[str, ScreenerTuningLevel]] = {
    preset_key: {field: "medium" for field in fields}
    for preset_key, fields in PRESET_TUNING_KEYS.items()
}

TUNING_COPY: dict[str, dict[str, dict[ScreenerTuningLevel, str]]] = {
    "quality-equities": {
        "quality_floor": {
            "low": "质量门槛偏宽松",
            "medium": "质量门槛保持标准",
            "high": "质量门槛更严格",
        },
        "trend_requirement": {
            "low": "趋势要求偏宽松",
            "medium": "趋势要求保持标准",
            "high": "趋势要求更严格",
        },
        "size_bias": {
            "low": "允许更广的大盘股范围",
            "medium": "维持标准大盘偏好",
            "high": "更偏向超大盘龙头",
        },
    },
    "growth-rebound": {
        "rebound_strength": {
            "low": "接受更早期的反弹修复",
            "medium": "维持标准反弹强度",
            "high": "更强调反弹确认",
        },
        "pullback_window": {
            "low": "接受更浅的回撤底",
            "medium": "维持标准回撤窗口",
            "high": "更偏好深度但未破坏结构的回撤",
        },
        "quality_guardrail": {
            "low": "基本面护栏偏宽松",
            "medium": "维持标准基本面护栏",
            "high": "基本面护栏更严格",
        },
    },
    "trend-crypto": {
        "momentum_bias": {
            "low": "动量确认偏宽松",
            "medium": "维持标准动量要求",
            "high": "更强调趋势延续",
        },
        "liquidity_floor": {
            "low": "流动性门槛偏宽松",
            "medium": "维持标准流动性门槛",
            "high": "更偏好高流动性主流币",
        },
        "volatility_tolerance": {
            "low": "只接受更平稳的波动",
            "medium": "维持标准波动容忍度",
            "high": "接受更高波动换取趋势机会",
        },
    },
    "majors-crypto": {
        "liquidity_bias": {
            "low": "允许更广的主流币流动性范围",
            "medium": "维持标准主流币流动性",
            "high": "更偏向最深流动性的龙头币",
        },
        "trend_requirement": {
            "low": "趋势要求偏宽松",
            "medium": "维持标准趋势要求",
            "high": "更强调持续走强",
        },
        "exhaustion_guardrail": {
            "low": "容忍更大的短线波动",
            "medium": "维持标准过热护栏",
            "high": "更严格回避过热币种",
        },
    },
}


def normalize_tuning(
    preset_key: str,
    tuning: dict[str, str] | None,
) -> dict[str, ScreenerTuningLevel]:
    expected_fields = PRESET_TUNING_KEYS.get(preset_key)
    if expected_fields is None:
        raise ValueError(f"Unsupported screener preset: {preset_key}")

    incoming = tuning or {}
    normalized: dict[str, ScreenerTuningLevel] = {}
    for field in expected_fields:
        raw_value = incoming.get(field, DEFAULT_TUNING_BY_PRESET[preset_key][field])
        if raw_value not in TUNING_LEVELS:
            raise ValueError(f"Unsupported tuning level for {field}: {raw_value}")
        normalized[field] = raw_value

    unexpected = sorted(set(incoming) - set(expected_fields))
    if unexpected:
        raise ValueError(f"Unsupported tuning fields for {preset_key}: {', '.join(unexpected)}")

    return normalized


def build_variant_filters(preset_key: str, tuning: dict[str, ScreenerTuningLevel]) -> list[str]:
    preset_copy = TUNING_COPY.get(preset_key)
    if preset_copy is None:
        raise ValueError(f"Unsupported screener preset: {preset_key}")
    return [preset_copy[field][tuning[field]] for field in PRESET_TUNING_KEYS[preset_key]]


def default_variant_seed(preset: dict[str, object]) -> dict[str, object]:
    preset_key = str(preset["key"])
    tuning = normalize_tuning(preset_key, DEFAULT_TUNING_BY_PRESET[preset_key])
    return {
        "variant_key": DEFAULT_VARIANT_KEY,
        "preset_key": preset_key,
        "name": "默认配置",
        "description": "保持当前基线评分逻辑，不开放自由 DSL。",
        "tuning": tuning,
        "filters": build_variant_filters(preset_key, tuning),
        "is_system_default": True,
        "is_active": True,
        "last_hit_count": int(preset.get("hit_count", 0)),
    }
