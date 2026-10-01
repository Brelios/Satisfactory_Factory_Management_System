import datetime
from typing import Dict, List, Tuple
from app.data.models import SolverResult, GameData, BeltConnection, ProductionStep


class BlueprintGenerator:
    """Generates an SVG schematic blueprint from a SolverResult."""

    def __init__(self, game_data: GameData):
        self.game_data = game_data

        # SVG Design Specifications
        self.bg_color = "#1A2332"
        self.grid_color = "#1E2D3D"
        self.padding = 80
        self.col_spacing = 300
        self.row_spacing = 160
        self.node_width = 230
        self.node_height = 130
        self.path_color = "#4A90D9"

    def _get_chain_color(self, item_id: str) -> str:
        """Get the border color based on the material chain."""
        lid = item_id.lower()
        if any(k in lid for k in ("iron", "plate", "rod", "screw", "reinforced", "modular_frame")):
            return "#C8A87C"
        elif any(k in lid for k in ("copper", "wire", "cable")):
            return "#E87C3C"
        elif any(k in lid for k in ("steel", "pipe", "beam", "encased")):
            return "#6B7B8D"
        elif any(k in lid for k in ("concrete", "limestone")):
            return "#D4C5A9"
        else:
            return "#4A90D9"

    def _topological_sort(self, result: SolverResult) -> Dict[str, int]:
        """Assign each step a column index based on depth from raw resources.
        
        Uses bounded relaxation to prevent infinite loops on cyclic graphs.
        """
        col_assignment: Dict[str, int] = {}

        for step in result.steps:
            col_assignment[step.step_id] = 0

        # Bounded relaxation — max iterations = num_steps^2 to prevent infinite loops
        max_iterations = max(len(result.steps) ** 2, 100)
        for _ in range(max_iterations):
            changed = False
            for conn in result.connections:
                from_id = conn.from_step_id
                to_id = conn.to_step_id
                if from_id not in col_assignment or to_id not in col_assignment:
                    continue
                if col_assignment[from_id] >= col_assignment[to_id]:
                    col_assignment[to_id] = col_assignment[from_id] + 1
                    changed = True
            if not changed:
                break

        # Shift so steps start at column 1 (column 0 = inputs)
        min_col = min(col_assignment.values(), default=0)
        for k in col_assignment:
            col_assignment[k] = col_assignment[k] - min_col + 1

        return col_assignment

    def generate(self, result: SolverResult) -> str:
        """Returns complete SVG markup as a string."""
        if not result.steps:
            return self._empty_svg()

        cols = self._topological_sort(result)

        # Group nodes by column
        col_groups: Dict[int, List[str]] = {}
        for node_id, col in cols.items():
            col_groups.setdefault(col, []).append(node_id)

        max_col = max(cols.values(), default=1)

        # Count resource and output stacks for sizing
        num_resources = len(result.resource_usage)
        num_outputs = len(result.target_outputs)

        # Assign coordinates
        positions: Dict[str, Tuple[float, float]] = {}
        max_rows = max(len(nodes) for nodes in col_groups.values()) if col_groups else 1
        # Account for resource/output stacks
        max_rows = max(max_rows, num_resources, num_outputs)

        content_top = self.padding + 60  # space for title block

        for col, nodes in col_groups.items():
            x = self.padding + col * self.col_spacing
            y_offset = content_top + (max_rows - len(nodes)) * self.row_spacing / 2
            for row, node_id in enumerate(nodes):
                y = y_offset + row * self.row_spacing
                positions[node_id] = (x, y)

        # Resource input positions (column 0)
        resource_positions: Dict[str, Tuple[float, float]] = {}
        res_x = self.padding
        for i, res_id in enumerate(result.resource_usage.keys()):
            res_y = content_top + (max_rows - num_resources) * self.row_spacing / 2 + i * 100
            resource_positions[res_id] = (res_x, res_y)

        # Output positions (last column + 1)
        output_positions: Dict[str, Tuple[float, float]] = {}
        out_x = self.padding + (max_col + 1) * self.col_spacing
        for i, prod_id in enumerate(result.target_outputs.keys()):
            out_y = content_top + (max_rows - num_outputs) * self.row_spacing / 2 + i * 100
            output_positions[prod_id] = (out_x, out_y)

        # Calculate canvas size
        all_x = [p[0] for p in positions.values()] + [p[0] for p in resource_positions.values()] + [p[0] for p in output_positions.values()]
        all_y = [p[1] for p in positions.values()] + [p[1] for p in resource_positions.values()] + [p[1] for p in output_positions.values()]

        width = max(max(all_x, default=0) + self.node_width + self.padding + 220, 900)  # extra for shopping list
        height = max(max(all_y, default=0) + self.node_height + self.padding + 40, 600)

        svg = []
        svg.append(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width} {height}" width="{width}" height="{height}">')

        # Background
        svg.append(f'<rect width="{width}" height="{height}" fill="{self.bg_color}" />')

        # Grid
        svg.append(f'''
        <defs>
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="{self.grid_color}" stroke-width="0.5"/>
            </pattern>
        </defs>
        <rect width="{width}" height="{height}" fill="url(#grid)" />
        ''')

        # Title Block
        svg.append(f'''
        <g transform="translate({self.padding}, {self.padding / 2})">
            <text x="0" y="0" fill="white" font-family="monospace, sans-serif" font-size="22" font-weight="bold">FACTORY BLUEPRINT</text>
            <text x="0" y="24" fill="#A0AEC0" font-family="sans-serif" font-size="13">
                ⚡ {result.total_power:.1f} MW  │  🏭 {result.total_machines} machines  │  {datetime.datetime.now().strftime("%Y-%m-%d %H:%M")}
            </text>
        </g>
        ''')

        # Draw Belt Connections
        drawn_labels: list[Tuple[float, float]] = []
        for conn in result.connections:
            if conn.from_step_id not in positions or conn.to_step_id not in positions:
                continue

            from_pos = positions[conn.from_step_id]
            to_pos = positions[conn.to_step_id]

            x1 = from_pos[0] + self.node_width
            y1 = from_pos[1] + self.node_height / 2
            x2 = to_pos[0]
            y2 = to_pos[1] + self.node_height / 2

            ctrl_x1 = x1 + (x2 - x1) * 0.4
            ctrl_x2 = x2 - (x2 - x1) * 0.4

            belt_width = 1.5 + (conn.belt_tier - 1) * 0.6
            belt_color = self._get_chain_color(conn.item_id)

            svg.append(f'<path d="M {x1} {y1} C {ctrl_x1} {y1}, {ctrl_x2} {y2}, {x2} {y2}" '
                        f'fill="none" stroke="{belt_color}" stroke-width="{belt_width}" opacity="0.7" />')

            # Label at midpoint — offset vertically to avoid overlaps
            mid_x = (x1 + x2) / 2
            mid_y = (y1 + y2) / 2

            # Nudge label if it would overlap a previous one
            for lx, ly in drawn_labels:
                if abs(mid_x - lx) < 80 and abs(mid_y - ly) < 25:
                    mid_y += 28
            drawn_labels.append((mid_x, mid_y))

            item_name = self.game_data.items[conn.item_id].display_name if conn.item_id in self.game_data.items else conn.item_id

            svg.append(f'''
            <g transform="translate({mid_x}, {mid_y})">
                <rect x="-45" y="-14" width="90" height="28" fill="{self.bg_color}" rx="4" opacity="0.9" />
                <text x="0" y="-2" fill="white" font-family="sans-serif" font-size="9" text-anchor="middle">{item_name}</text>
                <text x="0" y="10" fill="#90CDF4" font-family="sans-serif" font-size="9" text-anchor="middle">{conn.rate:.1f}/min Mk.{conn.belt_tier}</text>
            </g>
            ''')

        # Draw Resource Input Nodes
        for res_id, (rx, ry) in resource_positions.items():
            rate = result.resource_usage.get(res_id, 0)
            res_name = self.game_data.items[res_id].display_name if res_id in self.game_data.items else res_id
            res_color = self._get_chain_color(res_id)

            svg.append(f'''
            <g transform="translate({rx}, {ry})">
                <circle cx="30" cy="30" r="28" fill="{res_color}" opacity="0.9" />
                <circle cx="30" cy="30" r="28" fill="none" stroke="white" stroke-width="1.5" opacity="0.3" />
                <text x="30" y="35" fill="white" font-family="sans-serif" font-size="11" text-anchor="middle" font-weight="bold">⛏</text>
                <text x="30" y="72" fill="white" font-family="sans-serif" font-size="11" text-anchor="middle">{res_name}</text>
                <text x="30" y="86" fill="{res_color}" font-family="monospace" font-size="11" text-anchor="middle" font-weight="bold">{rate:.0f}/min</text>
            </g>
            ''')

            # Draw path from resource to consuming steps
            for step in result.steps:
                if res_id in step.input_rates and step.step_id in positions:
                    sx, sy = positions[step.step_id]
                    x1, y1 = rx + 58, ry + 30
                    x2, y2 = sx, sy + self.node_height / 2
                    cx1 = x1 + (x2 - x1) * 0.3
                    cx2 = x2 - (x2 - x1) * 0.3
                    svg.append(f'<path d="M {x1} {y1} C {cx1} {y1}, {cx2} {y2}, {x2} {y2}" '
                                f'fill="none" stroke="{res_color}" stroke-width="1.5" opacity="0.4" stroke-dasharray="6,3" />')

        # Draw Machine Nodes
        for node_id, (x, y) in positions.items():
            step = result.get_step(node_id)
            if not step:
                continue

            # Color based on main output
            main_out = list(step.output_rates.keys())[0] if step.output_rates else step.recipe_id
            border_color = self._get_chain_color(main_out)

            # Node background with gradient effect
            svg.append(f'''
            <g transform="translate({x}, {y})">
                <rect width="{self.node_width}" height="{self.node_height}" fill="#2D3748" stroke="{border_color}" stroke-width="2" rx="10" />
                <rect width="{self.node_width}" height="35" fill="{border_color}" rx="10" opacity="0.15" />

                <circle cx="22" cy="18" r="10" fill="{border_color}" opacity="0.8" />
                <text x="40" y="22" fill="white" font-family="sans-serif" font-size="13" font-weight="bold">{step.recipe.display_name}</text>

                <text x="15" y="55" fill="#CBD5E0" font-family="sans-serif" font-size="12">{step.machine_count}× {step.building.display_name}</text>
            ''')

            # Output rates — show each item separately
            y_out = 75
            for item_id, rate in step.output_rates.items():
                item_name = self.game_data.items[item_id].display_name if item_id in self.game_data.items else item_id
                svg.append(f'<text x="15" y="{y_out}" fill="#90CDF4" font-family="monospace" font-size="11" font-weight="bold">{item_name}: {rate:.1f}/min</text>')
                y_out += 15

            # Clock speed
            clock_display = round(step.clock_speed)
            if abs(step.clock_speed - 100.0) > 0.5:
                svg.append(f'<text x="15" y="{min(y_out + 5, self.node_height - 8)}" fill="#F6E05E" font-family="sans-serif" font-size="10">⏱ {clock_display}%</text>')
            else:
                svg.append(f'<text x="15" y="{min(y_out + 5, self.node_height - 8)}" fill="#A0AEC0" font-family="sans-serif" font-size="10">⏱ 100%</text>')

            # Power badge
            svg.append(f'<text x="{self.node_width - 12}" y="{self.node_height - 10}" fill="#A0AEC0" font-family="sans-serif" font-size="9" text-anchor="end">⚡{step.power_draw:.0f}MW</text>')

            svg.append('</g>')

        # Draw Output Product Nodes
        for prod_id, (px, py) in output_positions.items():
            rate = result.target_outputs.get(prod_id, 0)
            prod_name = self.game_data.items[prod_id].display_name if prod_id in self.game_data.items else prod_id

            svg.append(f'''
            <g transform="translate({px}, {py})">
                <polygon points="35,0 70,18 70,52 35,70 0,52 0,18" fill="#2ECC71" opacity="0.9" />
                <polygon points="35,0 70,18 70,52 35,70 0,52 0,18" fill="none" stroke="white" stroke-width="1" opacity="0.3" />
                <text x="35" y="40" fill="white" font-family="sans-serif" font-size="11" text-anchor="middle" font-weight="bold">✓</text>
                <text x="35" y="85" fill="white" font-family="sans-serif" font-size="11" text-anchor="middle">{prod_name}</text>
                <text x="35" y="100" fill="#2ECC71" font-family="monospace" font-size="12" text-anchor="middle" font-weight="bold">{rate:.1f}/min</text>
            </g>
            ''')

            # Draw path from producing steps to output
            for step in result.steps:
                if prod_id in step.output_rates and step.step_id in positions:
                    sx, sy = positions[step.step_id]
                    x1, y1 = sx + self.node_width, sy + self.node_height / 2
                    x2, y2 = px, py + 35
                    cx1 = x1 + (x2 - x1) * 0.3
                    cx2 = x2 - (x2 - x1) * 0.3
                    svg.append(f'<path d="M {x1} {y1} C {cx1} {y1}, {cx2} {y2}, {x2} {y2}" '
                                f'fill="none" stroke="#2ECC71" stroke-width="2" opacity="0.5" />')

        # Shopping List Panel (positioned below title, NOT overlapping output nodes)
        shop_x = width - 210
        shop_y = self.padding
        shop_items = list(result.shopping_list.items())
        shop_h = 40 + len(shop_items) * 20

        svg.append(f'''
        <g transform="translate({shop_x}, {shop_y})">
            <rect width="190" height="{shop_h}" fill="#2D3748" rx="8" opacity="0.9" />
            <text x="95" y="22" fill="white" font-family="sans-serif" font-size="12" font-weight="bold" text-anchor="middle">📋 Shopping List</text>
        ''')
        for i, (item_id, count) in enumerate(shop_items):
            name = self.game_data.buildings[item_id].display_name if item_id in self.game_data.buildings else item_id.replace("_", " ").title()
            svg.append(f'<text x="12" y="{42 + i * 20}" fill="#CBD5E0" font-family="sans-serif" font-size="11">{name}</text>')
            svg.append(f'<text x="178" y="{42 + i * 20}" fill="#90CDF4" font-family="monospace" font-size="11" text-anchor="end">×{count}</text>')
        svg.append('</g>')

        svg.append('</svg>')

        return "\n".join(svg)

    def _empty_svg(self) -> str:
        """Return a placeholder SVG when no results are available."""
        return '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 400" width="800" height="400">
            <rect width="800" height="400" fill="#1A2332" />
            <text x="400" y="200" fill="#4A5568" font-family="sans-serif" font-size="18" text-anchor="middle">No production steps to display</text>
        </svg>'''
