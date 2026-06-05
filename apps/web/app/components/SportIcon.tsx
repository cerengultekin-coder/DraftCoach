import {
  Bike, Footprints, Waves, Mountain, Dumbbell,
  PersonStanding, Sailboat, Snowflake, Medal,
  type LucideIcon,
} from "lucide-react";

const SPORT_ICON: Record<string, LucideIcon> = {
  Ride: Bike, VirtualRide: Bike, EBikeRide: Bike, Velomobile: Bike, Handcycle: Bike,
  Run: Footprints, VirtualRun: Footprints, TrailRun: Footprints,
  Swim: Waves,
  Walk: Mountain, Hike: Mountain,
  WeightTraining: Dumbbell, Workout: Dumbbell, Crossfit: Dumbbell, RockClimbing: Mountain,
  Yoga: PersonStanding,
  Rowing: Sailboat, Kayaking: Sailboat, Canoeing: Sailboat, Surfing: Waves, SUP: Waves,
  AlpineSki: Snowflake, BackcountrySki: Snowflake, CrossCountrySkiing: Snowflake,
  Snowboard: Snowflake, Snowshoe: Mountain, IceSkate: Snowflake,
};

export default function SportIcon({
  type,
  size = 20,
  className,
}: {
  type: string;
  size?: number;
  className?: string;
}) {
  const Icon = SPORT_ICON[type] ?? Medal;
  return <Icon size={size} className={className} strokeWidth={2} />;
}
