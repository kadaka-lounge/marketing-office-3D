# ComfyUI starter workflows

Canvas templates copied, without model substitutions, from Comfy-Org/workflow_templates
at commit 8be1f8c4b5af2d550d70922a23b79cee599e1f3e. MIT license: LICENSE.txt.

- qwen-image-2.1.canvas.json: templates/image_qwen_image_2_1_t2i.json
- ltx-2.5.canvas.json: templates/video_ltx2_5_t2v.json

These are canvas workflows to open in a recent ComfyUI. They are not API exports and
are not preconfigured for community GGUF/uncensored checkpoints. Choose compatible
loaders and your installed model/encoder/VAE filenames, test in ComfyUI, then export
API format for importing into the office. Model compatibility requires the model
card/source of the exact community checkpoint; no weights are downloaded here.

Qwen 2.1's current template uses TextEncodeQwenImage21 with a prompt input, Qwen3-VL
encoder, and a Qwen 2.1 VAE. Do not substitute an older Qwen 1.x pipeline blindly.
For GGUF install a compatible ComfyUI-GGUF version and select the loader supported
by the exact model card. If no compatible loader exists, keep generation disabled.

LTX 2.5's current template uses LTX 2.5 diffusion, audio/video VAE and Gemma4 encoder
files, plus a latent upscaler. ltx25_uncensored_v1.1-fp8 may be a full checkpoint or
only a diffusion component; use the loader and companion files required by its
model card. Select MP4 in SaveVideo before exporting.

Official model sources chosen by the user:
- https://huggingface.co/Qwen/Qwen-Image-2.1
- https://huggingface.co/Lightricks/LTX-2.5

These official repositories do not by themselves identify the exact community
GGUF/uncensored or fp8 filename. Select the installed variant and its required
loader/companion weights using that file's model card.

Wan starter template added from the same pinned source:
- wan-2.2-ti2v-5b.canvas.json: templates/video_wan2_2_5B_ti2v.json

The upstream canvas selects FP16 diffusion weights, UMT5 FP8 text encoder and
Wan 2.2 VAE. For Unsloth Wan2.2-TI2V-5B-FP8 select the actual compatible FP8
weights in the loader; the template does not substitute or download them.
It includes an optional LoadImage/start_image branch. For text-to-video disconnect
start_image and remove LoadImage before exporting API format. For image-to-video
prepare the initial image in ComfyUI; the office currently binds the text prompt
only. Positive prompt node: 6, input: text. Output node: 58, SaveVideo, choose MP4.

Unsloth presets are model sources served through native ComfyUI, not a separate
hosted API. Source selection is persisted. Switching source removes a previous
workflow unless a new API graph is submitted, so an old LTX workflow cannot be
silently reused for Wan. Model labels alone do not change the loaded files.
