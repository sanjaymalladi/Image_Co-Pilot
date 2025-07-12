import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const createGeneration = mutation({
  args: {
    generationType: v.union(v.literal("simple"), v.literal("advanced")),
    garmentImages: v.array(v.id("_storage")),
    backgroundRefImages: v.optional(v.array(v.id("_storage"))),
    modelRefImages: v.optional(v.array(v.id("_storage"))),
    garmentAnalysis: v.string(),
    qaChecklist: v.string(),
    initialJsonPrompt: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    return await ctx.db.insert("generations", {
      userId: identity.subject,
      userEmail: identity.email,
      createdAt: Date.now(),
      status: "generating",
      generatedImages: [],
      ...args,
    });
  },
});

export const addGeneratedImage = mutation({
  args: {
    generationId: v.id("generations"),
    title: v.string(),
    prompt: v.string(),
    imageId: v.id("_storage"),
    aspectRatio: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const generation = await ctx.db.get(args.generationId);
    if (!generation || generation.userId !== identity.subject) {
      throw new Error("Generation not found or unauthorized");
    }
    const newImage = {
      title: args.title,
      prompt: args.prompt,
      imageId: args.imageId,
      aspectRatio: args.aspectRatio,
      generatedAt: Date.now(),
    };
    await ctx.db.patch(args.generationId, {
      generatedImages: [...generation.generatedImages, newImage],
    });
  },
});

export const markGenerationCompleted = mutation({
  args: { generationId: v.id("generations") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const generation = await ctx.db.get(args.generationId);
    if (!generation || generation.userId !== identity.subject) {
      throw new Error("Generation not found or unauthorized");
    }
    await ctx.db.patch(args.generationId, { status: "completed" });
  },
});

export const getUserGenerations = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    return await ctx.db
      .query("generations")
      .withIndex("by_user", (q) => q.eq("userId", identity.subject))
      .order("desc")
      .take(args.limit ?? 50);
  },
});

export const getGeneration = query({
  args: { generationId: v.id("generations") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const generation = await ctx.db.get(args.generationId);
    if (!generation || generation.userId !== identity.subject) {
      throw new Error("Generation not found or unauthorized");
    }
    return generation;
  },
});

export const deleteGeneration = mutation({
  args: { generationId: v.id("generations") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const generation = await ctx.db.get(args.generationId);
    if (!generation || generation.userId !== identity.subject) {
      throw new Error("Generation not found or unauthorized");
    }
    for (const img of generation.generatedImages) {
      await ctx.storage.delete(img.imageId);
    }
    for (const garmentImg of generation.garmentImages) {
      await ctx.storage.delete(garmentImg);
    }
    await ctx.db.delete(args.generationId);
  },
}); 