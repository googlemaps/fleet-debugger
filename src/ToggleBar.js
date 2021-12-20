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

const docLinks = {
  showGPSBubbles:
    "https://github.com/googlemaps/fleet-debugger/blob/main/docs/GPSAccuracy.md",
  showHeading:
    "https://github.com/googlemaps/fleet-debugger/blob/main/docs/Heading.md",
  showSpeed:
    "https://github.com/googlemaps/fleet-debugger/blob/main/docs/Speed.md",
  showDwellLocations:
    "https://github.com/googlemaps/fleet-debugger/blob/main/docs/DwellTimes.md",
  showHighVelocityJumps:
    "https://github.com/googlemaps/fleet-debugger/blob/main/docs/VelocityJumps.md",
  showMissingUpdates:
    "https://github.com/googlemaps/fleet-debugger/blob/main/docs/MissingUpdates.md",
};

const ButtonGroup = styled.div`
  display: flex;
`;
function ToggleBar(props) {
  // TODO: learn JSX ... make this a for loop
  return (
    <ButtonGroup>
      <ButtonToggle
        active={props.showGPSBubbles}
        onClick={props.onClickGPSBubbles}
      >
        GPS Accuracy
        <a href={docLinks.showGPSBubbles} target="_blank" rel="noreferrer">
          ?
        </a>
      </ButtonToggle>
      <ButtonToggle active={props.showHeading} onClick={props.onClickHeading}>
        Heading
        <a href={docLinks.showHeading} target="_blank" rel="noreferrer">
          ?
        </a>
      </ButtonToggle>
      <ButtonToggle active={props.showSpeed} onClick={props.onClickSpeed}>
        Speed
        <a href={docLinks.showSpeed} target="_blank" rel="noreferrer">
          ?
        </a>
      </ButtonToggle>
      <ButtonToggle
        active={props.showDwellLocations}
        onClick={props.onClickDwellLocations}
      >
        Dwell Locations
        <a href={docLinks.showDwellLocations} target="_blank" rel="noreferrer">
          ?
        </a>
      </ButtonToggle>
      <ButtonToggle
        active={props.showHighVelocityJumps}
        onClick={props.onClickHighVelocityJumps}
      >
        Jumps (unrealistic velocity)
        <a
          href={docLinks.showHighVelocityJumps}
          target="_blank"
          rel="noreferrer"
        >
          ?
        </a>
      </ButtonToggle>
      <ButtonToggle
        active={props.showMissingUpdates}
        onClick={props.onClickMissingUpdates}
      >
        Jumps (Temporal)
        <a href={docLinks.showMissingUpdates} target="_blank" rel="noreferrer">
          ?
        </a>
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
