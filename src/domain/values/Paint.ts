import { DomainError } from '../errors/DomainError.js';

// Fixed W3C CSS Color 4 section 6.1 named-color table. No runtime CSS parser/network.
// https://www.w3.org/TR/css-color-4/#named-colors (EXEC-P1 v1.0 selection)
export class Paint {
  static readonly #names = new Set(
    `aliceblue antiquewhite aqua aquamarine azure beige bisque black blanchedalmond blue blueviolet brown burlywood cadetblue chartreuse chocolate coral cornflowerblue cornsilk crimson cyan darkblue darkcyan darkgoldenrod darkgray darkgreen darkgrey darkkhaki darkmagenta darkolivegreen darkorange darkorchid darkred darksalmon darkseagreen darkslateblue darkslategray darkslategrey darkturquoise darkviolet deeppink deepskyblue dimgray dimgrey dodgerblue firebrick floralwhite forestgreen fuchsia gainsboro ghostwhite gold goldenrod gray green greenyellow grey honeydew hotpink indianred indigo ivory khaki lavender lavenderblush lawngreen lemonchiffon lightblue lightcoral lightcyan lightgoldenrodyellow lightgray lightgreen lightgrey lightpink lightsalmon lightseagreen lightskyblue lightslategray lightslategrey lightsteelblue lightyellow lime limegreen linen magenta maroon mediumaquamarine mediumblue mediumorchid mediumpurple mediumseagreen mediumslateblue mediumspringgreen mediumturquoise mediumvioletred midnightblue mintcream mistyrose moccasin navajowhite navy oldlace olive olivedrab orange orangered orchid palegoldenrod palegreen paleturquoise palevioletred papayawhip peachpuff peru pink plum powderblue purple rebeccapurple red rosybrown royalblue saddlebrown salmon sandybrown seagreen seashell sienna silver skyblue slateblue slategray slategrey snow springgreen steelblue tan teal thistle tomato turquoise violet wheat white whitesmoke yellow yellowgreen`.split(
      ' ',
    ),
  );
  static parse(value: unknown): string {
    if (typeof value !== 'string') throw new DomainError('INVALID_VALUE', { field: 'paint' });
    const normalized = value.replace(/^[\x20\t\r\n]+|[\x20\t\r\n]+$/g, '').toLowerCase();
    if (
      normalized !== 'none' &&
      !this.#names.has(normalized) &&
      !/^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/.test(normalized)
    ) {
      throw new DomainError('INVALID_VALUE', { field: 'paint' });
    }
    return normalized;
  }
}
