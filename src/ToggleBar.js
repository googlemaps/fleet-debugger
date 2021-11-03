/*
 * ToggleBar.js
 *
 * Row of buttons that configure visualization options on the map
 */
import React from "react";
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
    </ButtonGroup>
  );
}

export default ToggleBar;
