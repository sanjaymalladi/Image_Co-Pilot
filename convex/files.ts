import { v } from "convex/values";
import { mutation } from "./_generated/server";

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx, args) => {
    return await ctx.storage.generateUploadUrl();
  },
});

export const getFileUrl = mutation({
  args: { fileId: v.id("_storage") },
  handler: async (ctx, args) => {
    return await ctx.storage.getUrl(args.fileId);
  },
}); 