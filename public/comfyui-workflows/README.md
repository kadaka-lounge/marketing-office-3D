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
