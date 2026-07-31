# Orange Pi Zero 3 — Network Operations Guide

Operational notes for the RallyOS hub's Orange Pi Zero 3 (Armbian). Covers
WiFi client connectivity (wlan0 → home/venue network), the kiosk access point,
and how to troubleshoot "no internet" on the device.

## Network topology

| Interface | Role | Address |
|---|---|---|
| `wlx90de8018370a` | Kiosk WiFi AP (USB dongle RTL8821CU) — SSID `RallyOS` | `192.168.4.1/24` |
| `wlan0` | WiFi client (integrated XR829, dual-band 2.4/5 GHz) — connects to the venue/home network for internet | DHCP |
| `end0` | Ethernet — no cable connected in the current setup | — |

The kiosk AP (`wlx90de...`) is configured via `systemd-networkd` files in
`/etc/systemd/network/` and must NOT be changed during WiFi-client fixes:

- `10-rallyos-ap.network`
- `10-rallyos-wlx90de8018370a.network`
- `30-wlx-ap.network`

> Junk file present on the device: `30-wlx-ap.networky` (typo/copy artifact).
> Safe to delete, but not required for operation.

## Key fact: this Armbian image has NO NetworkManager

`nmcli` is **not installed**. Also missing: `dhclient`, `dhcpcd`, `udhcpc`,
`busybox`. WiFi client networking is managed by:

```
netplan (/etc/netplan/*.yaml)  →  wpa_supplicant  →  systemd-networkd
```

So the correct way to change the WiFi client password is via **netplan**, not
`nmcli` or raw `wpa_supplicant`.

## How to change the WiFi client password (wlan0)

The client network is defined in `/etc/netplan/30-wifis-dhcp.yaml`:

```yaml
network:
  wifis:
    wlan0:
      dhcp4: yes
      dhcp6: yes
      access-points:
        "TIMELINE-56 -5G":
         password: "OLD_PASSWORD"
```

Update the password and apply:

```bash
sed -i 's/OLD_PASSWORD/NEW_PASSWORD/' /etc/netplan/30-wifis-dhcp.yaml

# Verify the change
cat /etc/netplan/30-wifis-dhcp.yaml

# Apply (regenerates wpa_supplicant + systemd-networkd for wlan0 only)
netplan apply

sleep 5
ip addr show wlan0      # expect an inet 192.168.x.x/24 line
ping -c 2 8.8.8.8       # expect replies
```

Notes:

- `netplan apply` prints
  `Cannot call openvswitch: ovsdb-server.service is not running.` — this is a
  **harmless warning**; the apply still works.
- If you SSH to the Pi **through the venue WiFi** (not the kiosk AP or serial),
  `netplan apply` will drop your connection for a few seconds. It reconnects
  automatically with the new password.
- `wlan0` is dual-band: it can connect to both 2.4 GHz and 5 GHz SSIDs. The
  current config uses the 5 GHz SSID (`TIMELINE-56 -5G`).

## Troubleshooting "Could not resolve host: github.com" / no internet

Symptom: `git pull` fails with `Could not resolve host: github.com`.

Diagnose in order:

```bash
# 1. Does the device have an IP on wlan0?
ip addr show wlan0

# 2. Is there a default route?
ip route

# 3. Internet reachable by IP (no DNS involved)?
ping -c 2 8.8.8.8

# 4. What DNS does the system use?
cat /etc/resolv.conf        # expected: nameserver 8.8.8.8

# 5. Is wlan0 actually associated to the AP? (trust this over networkctl)
iw dev wlan0 link

# 6. Which WiFi networks are visible, and on which band?
ip link set wlan0 up
iw dev wlan0 scan 2>/dev/null | grep -E "SSID:|freq:" | grep -B1 "YOUR_SSID"
#    freq: 24xx  → 2.4 GHz   (2412–2484)
#    freq: 5xxx  → 5 GHz     (5180+)
```

Interpretation:

- `ping 8.8.8.8` fails → no route/internet. Check `ip route` for a default
  gateway; check the netplan password (most common cause after a router
  password change).
- `ping 8.8.8.8` works but `github.com` does not resolve → DNS issue; check
  `/etc/resolv.conf` (should contain `nameserver 8.8.8.8`).
- `networkctl list` may show wlan0 as `no-carrier` even while
  `iw dev wlan0 link` reports `Connected` — trust `iw`, then fix DHCP.
- The Pi is intentionally an isolated AP by default (no uplink): `end0` is
  down and `wlan0` only gets internet once netplan is configured. This is by
  design for plug-and-play kiosk operation.

## Post-fix update procedure

```bash
cd /root/rallyOS-hub
git pull origin main
bash scripts/start-orange-pi.sh
```

## Hardware/OS reference

- Orange Pi Zero 3, Armbian `v26.5.1`, kernel `6.18.33-current-sunxi64`
- Integrated WiFi: XR829 (dual-band)
- USB WiFi dongle: Realtek RTL8821CU (`wlx90de8018370a`) — used as kiosk AP
- Kiosk display: Chromium `--kiosk https://localhost:3000/kiosk`
  (see `scripts/start-kiosk.sh`)
