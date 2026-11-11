# Image-to-video sample production — 2026-11-11

Internal production notes. The two source images are fictional, original images generated for this exercise with the built-in image generation tool; they are not customer products or album art. They do not document any real client or completed commission.

## Product photo: generated on Free AI Video

- Input: `product-input.png`, an unbranded amber bottle and leaf.
- Prompt: `A slow, subtle camera push toward the amber bottle as soft warm light shifts gently across the glass. The bottle, dropper and stone stay still and keep their shape. Photorealistic product shot, no text, no logos.`
- Model selected on the live site: MiniMax H3 (`minimax-h3-v2`). Mode: daily free trial, 480p, 4 seconds; aspect ratio follows the reference image.
- Submitted at 2026-11-11 07:20:43 UTC and succeeded at 07:21:31 UTC, job `job_751fc5541d5f4fa289685cf36690df49`.
- Original download: `product-video.mp4`, H.264/AAC, 480 × 832 pixels, file duration 4.458 seconds. All frames decoded successfully with FFmpeg. First/middle/last frames were inspected: the bottle remains recognizable, but the lighting, perspective and object details change. Do not claim brand or packaging fidelity from this fictional, unbranded example.
- User charge: zero credits; one daily free-trial request used. Recorded upstream charge: **$0.041497** in the job record. This is an internal observed cost for this run, not a public price or a guarantee of future costs.
- This is a single generated clip, not an edited advertisement or proof of commercial performance. No external editing was applied to the download.

## Music cover: generated on Free AI Video

- Input: `music-input.png`, an original, fictional rainy city scene. It is not an actual release cover.
- Prompt: `Animate this rainy city cover art: raindrops move down the window, distant cyan and violet reflections gently shimmer on the wet street, and the camera slowly pushes forward. Preserve the composition and moody nighttime palette. No text, logos, people, or cuts.`
- Model selected on the live site: MiniMax H3 (`minimax-h3-v2`). Mode: credit video, 768P, 6 seconds; aspect ratio determined by the reference image.
- Original download: `music-video.mp4`, H.264/AAC, 768 × 1344 pixels, file duration 6.583 seconds. All frames decoded successfully with FFmpeg; inspection of frames across the clip shows the rainy street composition is largely preserved with subtle motion and lighting changes. The result is a cover-art animation, not evidence of music or beat synchronization. No external editing was applied to the download.
- The daily free request was unavailable, so this one authorized generation used 11 existing credits (balance observed changing from 52 to 41). The job record reports an upstream charge of **$0.093093**; this is an internal observed cost, not the user-facing price or a guarantee of future costs.
- Job `job_81dd504a6fa443fa9b92a29d9018ddb4`; site reported success. The fictional input is not an actual release cover or client commission.
