import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  generations: defineTable({
    userId: v.string(),
    userEmail: v.optional(v.string()),
    generationType: v.union(v.literal("simple"), v.literal("advanced")),
    createdAt: v.number(),
    garmentImages: v.array(v.id("_storage")),
    backgroundRefImages: v.optional(v.array(v.id("_storage"))),
    modelRefImages: v.optional(v.array(v.id("_storage"))),
    garmentAnalysis: v.string(),
    qaChecklist: v.string(),
    initialJsonPrompt: v.string(),
    generatedImages: v.array(v.object({
      title: v.string(),
      prompt: v.string(),
      imageId: v.id("_storage"),
      aspectRatio: v.string(),
      generatedAt: v.number(),
    })),
    status: v.union(
      v.literal("generating"),
      v.literal("completed"),
      v.literal("failed")
    ),
    error: v.optional(v.string()),
  })
    .index("by_user", ["userId"])
    .index("by_user_and_date", ["userId", "createdAt"]),
}); 