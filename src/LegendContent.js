export const LEGEND_HTML = `
<div style="margin-top: 5px; margin-right: 0px; padding: 0; font-family: Roboto, Arial, sans-serif; color: #333; font-size: 16px; font-weight: 600; display: flex; flex-direction: column;">
  <div style="display: flex; flex-direction: column; gap: 4px;">
    <div style="display: grid; grid-template-columns: 24px 1fr; align-items: center; font-size: 12px; color: #333; text-shadow: 0 0 2px rgba(255, 255, 255, 0.8); background: transparent; padding: 2px 0; margin-bottom: 2px;">
      <span style="width: 6px; height: 6px; border-radius: 50%; display: inline-block; justify-self: center; background-color: #FF0000;"></span> Raw Location
    </div>
    <div style="display: grid; grid-template-columns: 24px 1fr; align-items: center; font-size: 12px; color: #333; text-shadow: 0 0 2px rgba(255, 255, 255, 0.8); background: transparent; padding: 2px 0; margin-bottom: 2px;">
      <span style="width: 6px; height: 6px; border-radius: 50%; display: inline-block; justify-self: center; background-color: #4285F4;"></span> FLP Location
    </div>
    <div style="display: grid; grid-template-columns: 24px 1fr; align-items: center; font-size: 12px; color: #333; text-shadow: 0 0 2px rgba(255, 255, 255, 0.8); background: transparent; padding: 2px 0; margin-bottom: 2px;">
      <span style="width: 9px; height: 9px; border-radius: 50%; display: inline-block; justify-self: center; background-color: #C71585;"></span> FLP = Raw Location
    </div>
  </div>

  <div style="display: grid; grid-template-columns: 24px 1fr; align-items: center; font-size: 12px; color: #333; text-shadow: 0 0 2px rgba(255, 255, 255, 0.8); background: transparent; padding: 2px 0; margin-bottom: 2px;">
    <svg style="display: block; justify-self: center; margin-right: 0;" viewBox="0 0 24 24" width="24" height="24">
      <path d="M12 8 L5 16 L19 16 L12 8 Z" fill="#0dcaf0" stroke="black" stroke-width="1" stroke-linejoin="round"/>
    </svg>
    Pickup
  </div>

  <div style="display: grid; grid-template-columns: 24px 1fr; align-items: center; font-size: 12px; color: #333; text-shadow: 0 0 2px rgba(255, 255, 255, 0.8); background: transparent; padding: 2px 0; margin-bottom: 2px;">
    <svg style="display: block; justify-self: center; margin-right: 0;" viewBox="0 0 24 24" width="24" height="24">
      <path d="M12 5 L5 13 L19 13 L12 5 Z" fill="#0dcaf0" stroke="black" stroke-width="1" stroke-linejoin="round"/>
      <path d="M12 10 L5 18 L19 18 L12 10 Z" fill="#0dcaf0" stroke="black" stroke-width="1" stroke-linejoin="round"/>
    </svg>
    Actual Pickup
  </div>

  <div style="display: grid; grid-template-columns: 24px 1fr; align-items: center; font-size: 12px; color: #333; text-shadow: 0 0 2px rgba(255, 255, 255, 0.8); background: transparent; padding: 2px 0; margin-bottom: 2px;">
    <svg style="display: block; justify-self: center; margin-right: 0;" viewBox="0 0 24 24" width="24" height="24">
      <path d="M12 16 L5 8 L19 8 L12 16 Z" fill="#0dcaf0" stroke="black" stroke-width="1" stroke-linejoin="round"/>
    </svg>
    Dropoff
  </div>

  <div style="display: grid; grid-template-columns: 24px 1fr; align-items: center; font-size: 12px; color: #333; text-shadow: 0 0 2px rgba(255, 255, 255, 0.8); background: transparent; padding: 2px 0; margin-bottom: 2px;">
    <svg style="display: block; justify-self: center; margin-right: 0;" viewBox="0 0 24 24" width="24" height="24">
      <path d="M12 18 L5 10 L19 10 L12 18 Z" fill="#0dcaf0" stroke="black" stroke-width="1" stroke-linejoin="round"/>
      <path d="M12 13 L5 5 L19 5 L12 13 Z" fill="#0dcaf0" stroke="black" stroke-width="1" stroke-linejoin="round"/>
    </svg>
    Actual Dropoff
  </div>
</div>
`;
