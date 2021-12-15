/*
 * ToggleBar.js
 *
 * Row of buttons that configure visualization options on the map
 */
import styled from "styled-components";
const Button = styled.button``;
const ButtonToggle = styled(Button)`
  opacity: 0.6;
  ${({ active }) =>
    active &&
    `
    opacity: 1;
    color: Green;
  `}
`;

const ButtonGroup = styled.div`
  display: flex;
`;
function ToggleBar(props) {
  return (
    <ButtonGroup>
      <ButtonToggle
        active={props.showGPSBubbles}
        onClick={props.onClickGPSBubbles}
      >
        GPS Accuracy
      </ButtonToggle>
      <ButtonToggle active={props.showHeading} onClick={props.onClickHeading}>
        Heading
      </ButtonToggle>
      <ButtonToggle active={props.showSpeed} onClick={props.onClickSpeed}>
        Speed
      </ButtonToggle>
      <ButtonToggle
        active={props.showDwellLocations}
        onClick={props.onClickDwellLocations}
      >
        Dwell Locations
      </ButtonToggle>
      <ButtonToggle
        active={props.showHighVelocityJumps}
        onClick={props.onClickHighVelocityJumps}
      >
        Jumps (unrealistic velocity)
      </ButtonToggle>
      <ButtonToggle
        active={props.showMissingUpdates}
        onClick={props.onClickMissingUpdates}
      >
        Jumps (Temporal)
      </ButtonToggle>
      <ButtonToggle
        active={props.showClientServerTimeDeltas}
        onClick={props.onClickClientServerTimeDeltas}
      >
        Client/Server Time Deltas
      </ButtonToggle>
      <ButtonToggle active={props.showTraffic} onClick={props.onClickTraffic}>
        Traffic
      </ButtonToggle>
      <ButtonToggle active={props.showLiveJS} onClick={props.onClickLiveJS}>
        Start Live Journey Sharing for newest trip
      </ButtonToggle>
    </ButtonGroup>
  );
}

export default ToggleBar;
