# UEFA Champions League Mega-Auction & Next-Gen 3D Match Simulator
**Master Product Specification, 3D Graphics Pipeline & Technical Architecture Blueprint**  
**Document Version:** 2.0 (Enterprise & Next-Gen 3D Edition)  
**Target Platform:** WebGL 2.0 / WebGPU Browser Engine & Standalone HTML5 Runtime (`etihad_ucl_match.html`)

---

## 1. Executive Summary & Architectural Vision

The **UEFA Champions League Mega-Auction & Next-Gen 3D Match Simulator** is an end-to-end, high-fidelity sports management and real-time 3D match broadcast platform. It merges the high-stakes financial strategy of an uncapped multi-round transfer mega-auction with a physically simulated, broadcast-grade 3D football match engine.

Designed for both instant zero-dependency local Pass & Play and scalable real-time networked multiplayer, the platform allows managers to draft custom `1-4-3-3` squads from an all-time pool of modern 2026/27 superstars and prime retired icons, customize club crests, kits, and home stadiums, and experience a zero-spoiler live match broadcast featuring **articulated 3D player models, inverse-kinematics (IK) foot placement, dynamic cloth physics, volumetric stadium lighting, multi-angle VAR/goal replays, tactical AI formations, and live voice commentary**.

---

## 2. Comprehensive Project Scope

### 2.1 Core Functional Pillars
1. **Multi-Mode Transfer Mega-Auction Engine:**
   * Local Pass & Play simultaneous dual-bidding consoles + WebRTC/WebSocket room synchronization for cross-device online multiplayer.
   * Fisher–Yates randomized lot cycling across 72+ curated players, dynamic base-price valuation, strict `1-4-3-3` positional slot quotas, Right-to-Match (RTM) cards, blind/secret sealed-bid power rounds, and automated two-pass squad completion with Youth Academy reserve fallbacks.
2. **Next-Gen 3D Stadium & Character Pipeline:**
   * High-polygon articulated 3D human character rigs (`22` outfield/goalkeeper models + `1` Match Referee + `2` Assistant Referees) with blendshape facial expressions, custom UV-mapped kits, procedural hair/beard attachments, and dynamic sweat/mud shaders.
   * Photorealistic 3D stadium architecture featuring multi-tiered bowl geometry, animated 3D spectator crowds (instanced mesh rendering), dynamic volumetric floodlight cones, turf wear-and-tear shaders, and spring-mass goal net physics.
3. **Tactical Football AI & Physics Simulation Engine:**
   * Autonomous 11v11 utility-AI state machines (pressing triggers, offside trap lines, overlapping full-backs, inverted wingers, and zonal/man-marking set-piece routines).
   * Continuous rigid-body ball aerodynamics incorporating **Magnus effect spin curves**, **knuckleball turbulence**, turf friction coefficients, and wet-weather hydroplaning.
4. **Broadcast Presentation, Telemetry & Audio Engine:**
   * Real-time multi-camera director AI (Broadcast Wide, Tactical Spider-Cam, Low-Angle Pitchside, Goalkeeper POV, and Super-Slow-Motion `120fps` Close-Up Goal/VAR Replays).
   * Procedural Web Audio stadium acoustics (dynamic crowd roar swells tied to Expected Goals `xG` danger) + neural/Web Speech play-by-play commentary.

---

## 3. End-to-End User & Match Lifecycle

1. **Phase 1 — Manager, Club & Tactical Identity Setup:**
   * Managers configure personal names, club identities, 24+ vector/3D club crests, custom primary/secondary/third kit patterns (`stripes`, `sash`, `hoops`, `center`, `sleeves`), home stadium selection, starting transfer purse (`€750M`–`€1,500M`), player pool era, weather/pitch conditions, and single-leg vs. two-legged UCL knockout rules.
2. **Phase 2 — Live Randomized Mega-Auction Room:**
   * Randomized lots appear on stage with 3D turntable character previews and 6-attribute radar charts. Either manager can open bidding first or raise via incremental buttons, `ALL-IN`, or custom numeric inputs until one folds or runs out of purse/slots. Unsold lots re-queue in accelerated rounds until both XIs reach `11/11` or the auction is concluded.
3. **Phase 3 — Tactical Whiteboard & Pre-Match Lineup Sheet:**
   * Managers inspect their finalized `1-4-3-3` Starting XIs, assign Captaincy, Penalty Taker, and Free-Kick Specialist roles, set team mentality (`High Press`, `Balanced`, `Counter-Attack`, `Park the Bus`), and review squad `OVR` chemistry.
4. **Phase 4 — Pre-Kickoff Walkout & Live 3D Broadcast:**
   * Official UEFA Champions League walkout tunnel & anthem ceremony with lower-third Starting XI introductions, followed by a 90-minute (plus Extra Time `90'`–`120'` and Penalty Shootout) live 3D simulation, post-match xG heatmaps, pass networks, and Man of the Match awards.

---

## 4. Realistic 3D Models, Shaders & Animation Architecture

To achieve console-grade realism in the browser, the 3D rendering subsystem is structured around a physically based rendering (PBR) pipeline with automatic graceful fallback to high-DPI 2.5D perspective canvas rendering on low-power devices.

### 4.1 Articulated 3D Player & Referee Character Models
* **Skeletal Hierarchy (28-Bone Humanoid Rig):**
  * Root pelvis, 3-segment spine, neck/head, clavicles, upper/lower arms, hands, thighs, calves, ankles, and toe joints for realistic ball-striking biomechanics.
  * **Procedural Body Scaling:** Each player's 3D mesh dynamically scales in height and muscularity based on real-world profiles (e.g., `2.00m` Thibaut Courtois vs. `1.70m` Lionel Messi) and `PHY` attribute ratings.
* **Custom UV-Mapped Kit & Portrait System:**
  * Dynamic canvas-to-texture synthesis generates crisp `1024x1024` jersey textures with club crests, sponsor typography, sleeve trims, back-of-shirt player names, and squad numbers (`1–11`).
  * Normal maps add woven fabric micro-texture; roughness maps simulate moisture/sweat accumulation after the `60'` mark.
* **Procedural Facial & Hair Geometry:**
  * Distinct 3D hair meshes (`short fade`, `curly afro`, `long tied-back`, `slicked`) and facial hair layers matched to each player's deterministic profile, paired with blendshape animations for celebration shouts, fatigue, and frustration.
* **Animation State Machine & Inverse Kinematics (IK):**
  * **Locomotion Blending:** Smooth 2D blend-tree transitioning between idle breathing, jogging, full sprint (`PAC > 90` lean angle), lateral defensive jockeying, and backpedaling.
  * **Foot-Planting IK:** Raycasts onto the 3D turf surface prevent foot sliding during sharp cuts and plant the non-kicking foot accurately beside the ball during shots and passes.
  * **Signature Motion Clips:** Bicycle kicks, diving headers, finesse curlers, goalkeeper full-stretch fingertip dives, knee-slide corner celebrations, and referee Yellow/Red card raise animations.

### 4.2 3D Stadium Environment, Turf & Crowd Engineering
* **Architectural Stadium Bowls:**
  * Modular 3D stadium templates (e.g., *Etihad Stadium*, *Spotify Camp Nou*, *Santiago Bernabéu*, *Anfield*, *Allianz Arena*, *San Siro*) featuring multi-tiered grandstands, cantilever roof trusses, corner floodlight towers, and player tunnel entrances.
* **Volumetric Floodlights & Dynamic Shadows:**
  * Four high-intensity directional/spot light rigs casting soft PCF (Percentage-Closer Filtering) ground shadows for all 23 on-pitch models and the airborne ball, enhanced with subtle volumetric light shafts and night-sky atmospheric fog.
* **Anisotropic Turf & Dynamic Wear Shader:**
  * Procedural mowed grass stripes with blade-level normal detail, specular dew sheen, white chalk pitch markings, and progressive penalty-box/midfield turf scuffing as match minutes progress.
* **GPU-Instanced 3D Spectator Crowd:**
  * `15,000+` instanced spectator meshes wearing home and away club colors, animated via vertex shaders to perform synchronized wave chants, scarf raises, and explosive vertical jumps when goals are scored.
* **Perimeter LED Boards & Stadium Dressing:**
  * Scrolling emissive LED ad boards displaying live match score updates, club badges, home/away waving corner flags, and behind-goal supporter tifos.

### 4.3 Soft-Body Net & Cloth Physics
* **Spring-Mass Goal Net Mesh:**
  * Each goal net is modeled as a `24 x 12` lattice of spring-constrained vertices anchored to the 3D goalposts and ground pegs. When a shot crosses the goal line, ball momentum transfers directly into the net vertices, creating authentic billowing ripples and ball drop physics.
* **Jersey & Shorts Secondary Motion:**
  * Vertex-weighted cloth simulation adds subtle flutter to loose jerseys and corner flags driven by player sprint velocity and stadium wind vectors.

---

## 5. Advanced Auction Mechanics & Economy Features

| Feature | Technical Specification | Gameplay Impact |
| :--- | :--- | :--- |
| **Dual-Console Uncapped Bidding** | Simultaneous M1/M2 active pads with `+€5M`, `+€15M`, `+€30M`, `ALL-IN`, and `Custom €M` validation | Eliminates turn-lock latency; either manager can open bidding or drop a massive psychological jump bid. |
| **Multi-Round Accelerated Re-Queue** | Unsold/skipped lots persist in `app.auction.pool` with an incrementing `round` counter | Guarantees no superstar is permanently lost if skipped early; players cycle until both squads reach `11/11`. |
| **Two-Pass Auto-Completion** | Pass 1 greedy `OVR`-sorted assignment within remaining purse; Pass 2 `OVR 62–64` Academy Reserve fill | Prevents unfair free super-teams when a manager overspends early, rewarding disciplined purse management. |
| **Right-to-Match (RTM) Token** *(Roadmap)* | 1 tactical RTM card per manager allowing them to match the winning bid on a player from their chosen club preset | Adds club-loyalty strategy when drafting real-world club icons. |
| **Marquee Sealed-Bid Power Round** *(Roadmap)* | Blind single-bid showdown on top `OVR 96+` Prime Icons where the higher secret bid wins | Creates high-tension bluffing moments during marquee lots. |

---

## 6. Tactical 11v11 AI, Ball Physics & Simulation Engine

### 6.1 Autonomous 11v11 Tactical AI
* **Dynamic Formation Elasticity:** Players anchor to `1-4-3-3` tactical zones (`FORMATION_COORDS`) that compress horizontally and vertically around the ball's `(x, y)` coordinates, weighted by positional discipline (`GK` `0.08x` vs. `MID/FWD` `1.0x`).
* **Offside Line & Defensive Transitions:** Defenders maintain a coordinated offside line; fast wingers (`PAC >= 90`) make diagonal runs behind full-backs when creative midfielders (`PAS >= 90`) enter the middle third.
* **Goalkeeper Positioning & Reflex Tree:** Goalkeepers bisect the shooting angle between the ball and the center of the goal (`x = 0` or `x = 100`), triggering dive animations when shot velocity exceeds threshold limits.

### 6.2 Aerodynamic Ball Physics
* **3D Parabolic Trajectory & Spin:** Ball position `(x, y, z)` integrates gravity ($g = 9.81\,\text{m/s}^2$), air drag, and **Magnus lateral curve** ($\vec{F}_M = S (\vec{\omega} \times \vec{v})$) for bending finesse shots and knuckleball free-kicks.
* **Ground Shadow & Motion Trail:** Real-time ground projection `(x, y, 0)` scales inversely with ball altitude `z`, giving viewers unmistakable depth perception of aerial crosses, lobbed through-balls, and top-corner volleys.

### 6.3 Stat-Weighted Probability & Telemetry Model
* **Team Dominance & Possession Share:**
  $$\text{HomeShare} = \text{clamp}\Big(0.50 + (\overline{\text{OVR}}_{\text{home}} - \overline{\text{OVR}}_{\text{away}}) \times 0.018,\; 0.28,\; 0.72\Big)$$
* **Attribute-Powered Player Selection ($w_i = \text{stat}_i^{2.4}$):**
  * **Goals & Shots:** Weighted by Shooting (`SHO`).
  * **Assists & Key Passes:** Weighted by Passing (`PAS`).
  * **Progressive Carries:** Weighted by Dribbling (`DRI`) & Pace (`PAC`).
  * **Interceptions & Fouls/Cards:** Weighted by Defending (`DEF`) & Physicality (`PHY`).
* **Shot Conversion vs. Goalkeeper Reflexes:**
  $$P(\text{Goal} \mid \text{Chance}) = 0.36 + (\text{SHO}_{\text{attacker}} - \text{DEF}_{\text{GK}}) \times 0.008$$

---

## 7. Broadcast Camera Director, Audio & Multiplayer Architecture

### 7.1 Multi-Camera Broadcast Director
* **Dynamic Broadcast Cam:** Smoothly pans and zooms (`1.0x` to `1.15x`) into the final third during penalty-box attacks.
* **Wide Tactical Cam:** Fixed elevated panoramic angle for inspecting full 11v11 spacing and off-the-ball runs.
* **Close-Up Slow-Motion Goal Replay (`1.52x` Zoom):** Automatically activates on every goal (`sim.replay`), tracking the striker's swing, ball flight, goalkeeper dive, and net ripple in slow motion before returning to live play.
* **Pre-Kickoff Walkout & Lineup Lower-Thirds:** Introduces both Starting XIs with custom portraits, roles, and `OVR` ratings as players line up at the center circle.

### 7.2 Procedural Audio & Voice Commentary Engine
* **Web Audio API Synthesizer (`playSFX`):** Zero-asset procedural synthesis for auction bid chimes, wooden gavel hammer impacts, referee double-whistles, disciplinary card alerts, and stadium goal roars.
* **Live Voice Commentary (`speechSynthesis`):** Narrates kickoff, goals, assists, red/yellow cards, extra time, and penalty shootouts in real time alongside a scrolling live ticker and full commentary log.

### 7.3 Networked Multiplayer & Persistence Architecture (v2.1 Expansion)
* **WebRTC / WebSocket Room Sync:**
  * Authoritative host-client state synchronization using compact JSON deltas (`{ type: 'BID', teamIdx, amount, seq }`) with optimistic UI updates and deterministic PRNG seeds (`mulberry32`) so both remote screens render the exact same 3D match timeline.
* **LocalStorage / IndexedDB Career & Tournament Save:**
  * Persists manager profiles, custom club presets, draft history, and multi-season UCL trophy cabinets locally without requiring external backend servers.

---

## 8. Data Schemas & File Structure

### 8.1 Core Data Schemas
```json
{
  "PlayerSchema": {
    "id": "string",
    "name": "string",
    "pos": "GK | DEF | MID | FWD",
    "role": "GK | CB | LB | RB | CDM | CM | CAM | LW | RW | ST",
    "era": "modern | icon | reserve",
    "club": "string",
    "flag": "string",
    "base": "number (Millions EUR)",
    "ovr": "number (62-98)",
    "stats": { "pac": 92, "sho": 87, "pas": 90, "dri": 96, "def": 44, "phy": 72 }
  },
  "ClubPresetSchema": {
    "id": "string",
    "name": "string",
    "code": "string (3-letter scorebug code)",
    "primary": "hex",
    "secondary": "hex",
    "accent": "hex",
    "pattern": "solid | stripes | sash | center | sleeves | hoops",
    "stadium": "string"
  }
}
```

### 8.2 System Architecture Diagram
```text
┌─────────────────────────────────────────────────────────────────────────┐
│                        UI & VIEW CONTROLLER LAYER                       │
│  [1. Pass & Play Lobby] ─▶ [2. Dual-Bid Auction] ─▶ [3. XI Lineups]     │
└─────────────────────────────────────────────────────────┬───────────────┘
                                                          ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                   REAL-TIME 3D MATCH & BROADCAST ENGINE                 │
│  ┌───────────────────────┐  ┌───────────────────────┐  ┌──────────────┐ │
│  │  Stat-Weighted Event  │  │  11v11 Tactical AI &  │  │  Broadcast   │ │
│  │  & xG Timeline Engine │─▶│  Ball/Net 3D Physics  │─▶│  Cam & Replay│ │
│  └───────────────────────┘  └───────────────────────┘  └──────────────┘ │
│  ┌───────────────────────┐  ┌───────────────────────┐  ┌──────────────┐ │
│  │  60fps 3D Renderer    │  │  Procedural SVG Kits  │  │  WebAudio &  │ │
│  │  (WebGL / Canvas 3D)  │  │  & Player Portraits   │  │  Voice Comm  │ │
│  └───────────────────────┘  └───────────────────────┘  └──────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 9. Quality Assurance & Reliability Standards

1. **Zero-CDN Instant Boot (`0ms` Cold Start):** All CSS utility classes, 24 vector club crests, jersey generators, procedural player portraits, and 3D projection math run completely offline with zero external network dependencies.
2. **Strict Roster Integrity:** Unsold players never leak into match lineups; incomplete rosters are deterministically padded with `OVR 62–64` Youth Academy reserves.
3. **Zero-Spoiler Broadcast Guarantee:** Match scores always initialize at `0 - 0` and evolve dynamically minute-by-minute based on player attribute weights, Extra Time triggers, and Penalty Shootout outcomes.