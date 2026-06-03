export const SPORT_EMOJI: Record<string, string> = {
  Ride: "🚴", VirtualRide: "🚴", EBikeRide: "🚴", Velomobile: "🚴", Handcycle: "🚴",
  Run: "🏃", VirtualRun: "🏃", TrailRun: "🏃",
  Swim: "🏊",
  Walk: "🚶", Hike: "🥾",
  WeightTraining: "🏋️", Workout: "💪", Crossfit: "💪", RockClimbing: "🧗",
  Yoga: "🧘",
  Rowing: "🚣", Kayaking: "🚣", Canoeing: "🚣", Surfing: "🏄", SUP: "🏄",
  AlpineSki: "⛷️", BackcountrySki: "⛷️", CrossCountrySkiing: "⛷️",
  Snowboard: "🏂", Snowshoe: "🥾", IceSkate: "⛸️",
};

export const SPORT_COLOR: Record<string, string> = {
  Ride: "#F97316", VirtualRide: "#F97316", EBikeRide: "#F97316", Velomobile: "#F97316", Handcycle: "#F97316",
  Run: "#EF4444", VirtualRun: "#EF4444", TrailRun: "#EF4444",
  Swim: "#06B6D4",
  Walk: "#10B981", Hike: "#10B981",
  WeightTraining: "#8B5CF6", Workout: "#8B5CF6", Crossfit: "#8B5CF6", RockClimbing: "#8B5CF6",
  Yoga: "#EC4899",
  Rowing: "#3B82F6", Kayaking: "#3B82F6", Canoeing: "#3B82F6", Surfing: "#3B82F6", SUP: "#3B82F6",
  AlpineSki: "#60A5FA", BackcountrySki: "#60A5FA", CrossCountrySkiing: "#60A5FA",
  Snowboard: "#60A5FA", Snowshoe: "#10B981", IceSkate: "#60A5FA",
};

export const sportEmoji = (type: string) => SPORT_EMOJI[type] ?? "🏅";
export const sportColor = (type: string) => SPORT_COLOR[type] ?? "#4F8CFF";
