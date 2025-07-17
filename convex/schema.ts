import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  history: defineTable({
    userId: v.string(),
    prompt: v.string(),
    imageUrl: v.string(),
    title: v.optional(v.string()),
    aspectRatio: v.string(),
    metadata: v.optional(v.object({
      model: v.string(),
      originalPrompt: v.optional(v.string()),
      refinedPrompt: v.optional(v.string()),
      editHistory: v.optional(v.array(v.object({
        editPrompt: v.string(),
        resultUrl: v.string(),
        timestamp: v.number(),
      }))),
    })),
    createdAt: v.number(),
  }).index("by_user", ["userId"])
    .index("by_user_created", ["userId", "createdAt"]),
});