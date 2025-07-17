import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// Query to get user's history, ordered by creation date (newest first)
export const getUserHistory = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const history = await ctx.db
      .query("history")
      .withIndex("by_user_created", (q) => q.eq("userId", args.userId))
      .order("desc")
      .collect();
    
    return history;
  },
});

// Query to get a specific history item
export const getHistoryItem = query({
  args: { id: v.id("history") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

// Mutation to save a new history item
export const saveHistoryItem = mutation({
  args: {
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
  },
  handler: async (ctx, args) => {
    const historyId = await ctx.db.insert("history", {
      userId: args.userId,
      prompt: args.prompt,
      imageUrl: args.imageUrl,
      title: args.title,
      aspectRatio: args.aspectRatio,
      metadata: args.metadata,
      createdAt: Date.now(),
    });
    
    return historyId;
  },
});

// Mutation to delete a history item
export const deleteHistoryItem = mutation({
  args: { id: v.id("history") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});

// Mutation to update a history item (for adding edit history)
export const updateHistoryItem = mutation({
  args: {
    id: v.id("history"),
    editHistory: v.optional(v.array(v.object({
      editPrompt: v.string(),
      resultUrl: v.string(),
      timestamp: v.number(),
    }))),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db.get(args.id);
    if (!existing) {
      throw new Error("History item not found");
    }

    await ctx.db.patch(args.id, {
      metadata: {
        model: existing.metadata?.model || 'unknown',
        originalPrompt: existing.metadata?.originalPrompt,
        refinedPrompt: existing.metadata?.refinedPrompt,
        editHistory: args.editHistory,
      },
    });
  },
});